import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesKey } from "@earendil-works/pi-tui";
import { ModalEditor } from "../index.js";
import { stubTheme, stubTui } from "./harness.js";

type AutocompleteInternals = {
  autocompleteList?: { getSelectedItem(): { value: string; label: string } };
  autocompletePrefix?: string;
  autocompleteProvider?: {
    applyCompletion(): {
      lines: string[];
      cursorLine: number;
      cursorCol: number;
    };
  };
  autocompleteState?: unknown;
};

type SubmitEditor = ModalEditor & {
  onSubmit: (text: string) => void;
};

function createEditor(): ModalEditor {
  const keybindings = {
    matches: (data: string, action: string) =>
      action === "tui.input.submit" && matchesKey(data, "enter"),
    getKeys: () => [] as string[],
  } as unknown as ConstructorParameters<typeof ModalEditor>[2];
  return new ModalEditor(stubTui, stubTheme, keybindings);
}

function showSlashCompletion(
  editor: ModalEditor,
  value = "/reload",
): () => number {
  let applications = 0;
  const autocomplete = editor as unknown as AutocompleteInternals;
  autocomplete.autocompleteState = "slash";
  autocomplete.autocompletePrefix = editor.getText();
  autocomplete.autocompleteList = {
    getSelectedItem: () => ({ value, label: value }),
  };
  autocomplete.autocompleteProvider = {
    applyCompletion() {
      applications++;
      return { lines: [value], cursorLine: 0, cursorCol: value.length };
    },
  };
  return () => applications;
}

describe("autocomplete Enter behavior", () => {
  it("accepts and submits a visible slash completion", () => {
    const editor = createEditor();
    let submitted: string | undefined;
    (editor as SubmitEditor).onSubmit = (text) => {
      submitted = text;
    };
    editor.setText("/relo");
    const applications = showSlashCompletion(editor);

    editor.handleInput("\r");

    assert.equal(applications(), 1);
    assert.equal(submitted, "/reload");
  });

  it("keeps Enter as a newline without autocomplete", () => {
    const editor = createEditor();
    let submitted = false;
    (editor as SubmitEditor).onSubmit = () => {
      submitted = true;
    };
    editor.setText("hello");

    editor.handleInput("\r");

    assert.equal(editor.getText(), "hello\n");
    assert.equal(submitted, false);
  });

  it("cancels completion before normal Enter submits exact text", () => {
    const editor = createEditor();
    let submitted: string | undefined;
    (editor as SubmitEditor).onSubmit = (text) => {
      submitted = text;
    };
    editor.setText("/reload");
    const applications = showSlashCompletion(editor);

    editor.handleInput("\x1b");
    assert.equal(editor.getMode(), "normal");
    assert.equal(editor.isShowingAutocomplete(), false);
    editor.handleInput("\r");

    assert.equal(applications(), 0);
    assert.equal(submitted, "/reload");
  });

  it("ignores a late stale completion in normal mode", () => {
    const editor = createEditor();
    let submitted: string | undefined;
    (editor as SubmitEditor).onSubmit = (text) => {
      submitted = text;
    };
    editor.setText("/reload");
    editor.handleInput("\x1b");
    const applications = showSlashCompletion(editor);

    editor.handleInput("\r");

    assert.equal(applications(), 0);
    assert.equal(submitted, "/reload");
  });

  it("clears stale completion before normal-mode insert re-entry", () => {
    const editor = createEditor();
    let submitted: string | undefined;
    (editor as SubmitEditor).onSubmit = (text) => {
      submitted = text;
    };
    editor.setText("/relo");
    editor.handleInput("\x1b");
    const applications = showSlashCompletion(editor, "/reload");

    // The completion arrived after Escape, while the editor was already normal.
    editor.handleInput("i");
    assert.equal(editor.getMode(), "insert");
    assert.equal(editor.isShowingAutocomplete(), false);
    editor.handleInput("\r");

    assert.equal(applications(), 0);
    assert.equal(editor.getText(), "/rel\no");
    assert.equal(submitted, undefined);
  });
});
