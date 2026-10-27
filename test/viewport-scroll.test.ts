/**
 * Pi-transcript scrolling in normal mode.
 *
 * Not nvim parity: a terminal transcript has no Vim analogue, so these keys are
 * an intentional divergence (see the README's vim-differences table). The
 * editor reaches Pi's fullscreen viewport through the `tui` it was constructed
 * with, which the stub below imitates.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ModalEditor } from "../index.js";
import { stubKeybindings, stubTheme } from "./harness.js";

type ModalEditorConstructorArgs = ConstructorParameters<typeof ModalEditor>;

const CTRL_D = "\x04";
const CTRL_U = "\x15";
const CTRL_E = "\x05";
const CTRL_Y = "\x19";

function createScrollingEditor(
  options: { rows?: number; scrollable?: boolean } = {},
) {
  const scrollCalls: number[] = [];
  const tui = {
    requestRender() {},
    terminal: { rows: options.rows ?? 40, cols: 120 },
    ...(options.scrollable === false
      ? {}
      : {
          scrollBy(lines: number) {
            scrollCalls.push(lines);
          },
        }),
  } as unknown as ModalEditorConstructorArgs[0];
  const editor = new ModalEditor(tui, stubTheme, stubKeybindings);

  for (const char of "hello world") editor.handleInput(char);
  editor.handleInput("\x1b");
  editor.handleInput("0");

  return { editor, scrollCalls };
}

test("ctrl-d and ctrl-u scroll half a screen in normal mode", () => {
  const { editor, scrollCalls } = createScrollingEditor({ rows: 40 });

  editor.handleInput(CTRL_D);
  editor.handleInput(CTRL_U);

  assert.deepEqual(scrollCalls, [20, -20]);
});

test("ctrl-e and ctrl-y scroll one line in normal mode", () => {
  const { editor, scrollCalls } = createScrollingEditor();

  editor.handleInput(CTRL_E);
  editor.handleInput(CTRL_Y);

  assert.deepEqual(scrollCalls, [1, -1]);
});

test("a count sets the line count instead of half a screen", () => {
  const { editor, scrollCalls } = createScrollingEditor({ rows: 40 });

  for (const key of ["3", CTRL_D, "7", CTRL_Y]) editor.handleInput(key);

  assert.deepEqual(scrollCalls, [3, -7]);
});

test("scroll keys leave the buffer and the mode alone", () => {
  const { editor } = createScrollingEditor();

  editor.handleInput(CTRL_D);
  editor.handleInput(CTRL_E);

  assert.equal(editor.getText(), "hello world");
  assert.equal(editor.getMode(), "normal");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 0 });
});

test("insert mode keeps ctrl-e and ctrl-y for Pi", () => {
  const { editor, scrollCalls } = createScrollingEditor();

  editor.handleInput("i");
  editor.handleInput(CTRL_E);
  editor.handleInput(CTRL_Y);

  assert.deepEqual(scrollCalls, []);
});

test("visual mode does not scroll", () => {
  const { editor, scrollCalls } = createScrollingEditor();

  editor.handleInput("v");
  editor.handleInput(CTRL_D);

  assert.deepEqual(scrollCalls, []);
});

test("without a scrollable viewport the keys fall through to Pi", () => {
  const { editor, scrollCalls } = createScrollingEditor({ scrollable: false });

  editor.handleInput(CTRL_D);

  assert.deepEqual(scrollCalls, []);
  assert.equal(editor.getMode(), "normal");
});
