/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/codeblockcommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';

import first from '@ckeditor/ckeditor5-utils/src/first';

/**
 * The code block command plugin.
 *
 * @extends module:core/command~Command
 */
export default class CodeBlockCommand extends Command {
	/**
	 * Whether the selection starts in a code block.
	 *
	 * @observable
	 * @readonly
	 * @member {Boolean} #value
	 */

	/**
	 * @inheritDoc
	 */
	refresh() {
		this.value = this._getValue();
		this.isEnabled = this._checkEnabled();
	}

	/**
	 * Executes the command. When the command {@link #value is on}, all top-most code blocks within
	 * the selection will be removed. If it is off, all selected blocks will be flattened and
	 * wrapped by a code block.
	 *
	 * @fires execute
	 * @param {Object} [options] Command options.
	 * @param {Boolean} [options.forceValue] If set, it will force the command behavior. If `true`, the command will apply a code block,
	 * otherwise the command will remove the code block. If not set, the command will act basing on its current value.
	 */
	execute( options = {} ) {
		const model = this.editor.model;
		const selection = model.document.selection;

		const blocks = Array.from( selection.getSelectedBlocks() );
		const value = ( options.forceValue === undefined ) ? !this.value : options.forceValue;

		model.change( writer => {
			if ( value ) {
				this._applyCodeBlock( writer, blocks );
			} else {
				this._removeCodeBlock( writer, blocks );
			}
		} );
	}

	/**
	 * Checks the command's {@link #value}.
	 *
	 * @private
	 * @returns {Boolean} The current value.
	 */
	_getValue() {
		const selection = this.editor.model.document.selection;
		const firstBlock = first( selection.getSelectedBlocks() );

		return !!( firstBlock && firstBlock.is( 'codeBlock' ) );
	}

	/**
	 * Checks whether the command can be enabled in the current context.
	 *
	 * @private
	 * @returns {Boolean} Whether the command should be enabled.
	 */
	_checkEnabled() {
		if ( this.value ) {
			return true;
		}

		const selection = this.editor.model.document.selection;
		const schema = this.editor.model.schema;

		const firstBlock = first( selection.getSelectedBlocks() );

		if ( !firstBlock ) {
			return false;
		}

		return canBeCodeBlock( schema, firstBlock );
	}

	/**
	 * @private
	 * @param {module:engine/model/writer~Writer} writer
	 * @param {Array.<module:engine/model/element~Element>} blocks
	 */
	_applyCodeBlock( writer, blocks ) {
		const schema = this.editor.model.schema;
		const allowedBlock = blocks.filter( block => canBeCodeBlock( schema, block ) );

		for ( const block of allowedBlock ) {
			writer.rename( block, 'codeBlock' );
		}

		allowedBlock.reverse().forEach( ( currentBlock, i ) => {
			const nextBlock = allowedBlock[ i + 1 ];

			if ( currentBlock.previousSibling === nextBlock ) {
				writer.appendElement( 'softBreak', nextBlock );
				writer.merge( writer.createPositionBefore( currentBlock ) );
			}
		} );
	}

	/**
	 * @private
	 * @param {module:engine/model/writer~Writer} writer
	 * @param {Array.<module:engine/model/element~Element>} blocks
	 */
	_removeCodeBlock( writer, blocks ) {
		const codeBlocks = blocks.filter( block => block.is( 'codeBlock' ) );

		for ( const block of codeBlocks ) {
			const range = writer.createRangeOn( block );

			for ( const item of Array.from( range.getItems() ).reverse() ) {
				if ( item.is( 'softBreak' ) && item.parent.is( 'codeBlock' ) ) {
					const { position } = writer.split( writer.createPositionBefore( item ) );

					writer.rename( position.nodeAfter, 'paragraph' );
					writer.remove( item );
				}
			}

			writer.rename( block, 'paragraph' );
		}
	}
}

function canBeCodeBlock( schema, element ) {
	if ( element.is( 'rootElement' ) || schema.isLimit( element ) ) {
		return false;
	}

	if ( !schema.checkChild( element.parent, 'codeBlock' ) ) {
		return false;
	}

	if ( !schema.isBlock( element ) && !schema.checkChild( element, '$text' ) ) {
		return false;
	}

	return true;
}
