/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test various things about the font chooser window, including
 * - whether if the font defined in font.name.<style>.<language> is not present
 * on the computer, we fall back to displaying what's in
 * font.name-list.<style>.<language>.
 */

var MODULE_NAME = "test-font-chooser";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "pref-window-helpers"];

ChromeUtils.import("resource://gre/modules/Services.jsm");

var gFontEnumerator;

// We'll test with Western. Unicode has issues on Windows (bug 550443).
var kLanguage = "x-western";

// A list of fonts present on the computer for each font type.
var gRealFontLists = {};

// A list of font types to consider
var kFontTypes = ["serif", "sans-serif", "monospace"];

function setupModule(module) {
  for (let lib of MODULE_REQUIRES) {
    collector.getModule(lib).installInto(module);
  }

  let finished = false;
  buildFontList().then(() => finished = true, Cu.reportError);
  mc.waitFor(() => finished, "Timeout waiting for font enumeration to complete.");
}

async function buildFontList() {
  gFontEnumerator = Cc["@mozilla.org/gfx/fontenumerator;1"]
                      .createInstance(Ci.nsIFontEnumerator);
  for (let fontType of kFontTypes) {
    gRealFontLists[fontType] =
      await gFontEnumerator.EnumerateFontsAsync(kLanguage, fontType);
    if (gRealFontLists[fontType].length == 0)
      throw new Error("No fonts found for language " + kLanguage +
                      " and font type " + fontType + ".");
  }
}

function assert_fonts_equal(aDescription, aExpected, aActual) {
  if (aExpected != aActual)
    throw new Error("The " + aDescription + " font should be " + aExpected +
                    ", but " + (aActual.length == 0 ?
                                "nothing is actually selected." :
                                "is actually " + aActual + "."));
}

/**
 * Verify that the given fonts are displayed in the font chooser. This opens the
 * pref window to the display pane and checks that, then opens the font chooser
 * and checks that too.
 */
function _verify_fonts_displayed(aSerif, aSansSerif, aMonospace) {
  function verify_display_pane(prefc) {
    let isSansDefault = (Services.prefs.getCharPref("font.default." + kLanguage) ==
                         "sans-serif");
    let displayPaneExpected = isSansDefault ? aSansSerif : aSerif;
    let displayPaneActual = prefc.e("defaultFont").value;
    assert_fonts_equal("display pane", displayPaneExpected, displayPaneActual);
  }

  // Bring up the preferences window.
  open_pref_window("paneDisplay", verify_display_pane);

  // Now verify the advanced dialog.
  function verify_advanced(fontc) {
    // The font pickers are populated async so we need to wait for it.
    for (let fontElemId of ["serif", "sans-serif", "monospace"]) {
      fontc.waitFor(() => fontc.e(fontElemId).value != "",
                    "Timeout waiting for font picker " + fontElemId + " to populate.");
    }
    assert_fonts_equal("serif", aSerif, fontc.e("serif").value);
    assert_fonts_equal("sans-serif", aSansSerif, fontc.e("sans-serif").value);
    assert_fonts_equal("monospace", aMonospace, fontc.e("monospace").value);
  }

  // Now open the advanced dialog.
  plan_for_modal_dialog("FontsDialog", verify_advanced);
  // XXX This would have been better done from within the prefs dialog, but
  // test-window-helper.js's WindowWatcher can only handle one modal window at a
  // time.
  mc.window.openDialog("chrome://messenger/content/preferences/fonts.xul",
                       "Fonts", "chrome,titlebar,toolbar,centerscreen,modal");
  wait_for_modal_dialog("FontsDialog");
}

/**
 * Test that for a particular language, whatever's in
 * font.name.<type>.<language> is displayed in the font chooser (if it is
 * present on the cocomputer).
 */
function test_font_name_displayed() {
  Services.prefs.setCharPref("font.language.group", kLanguage);

  // Pick the first font for each font type and set it.
  let expected = {};
  for (let [fontType, fontList] of Object.entries(gRealFontLists)) {
    // Work around bug 698238 (on Windows, Courier is returned by the enumerator but
    // substituted with Courier New) by getting the standard (substituted) family
    // name for each font.
    let standardFamily = gFontEnumerator.getStandardFamilyName(fontList[0]);
    Services.prefs.setCharPref("font.name." + fontType + "." + kLanguage,
                               standardFamily);
    expected[fontType] = standardFamily;
  }

  let fontTypes = kFontTypes.map(fontType => expected[fontType]);
  _verify_fonts_displayed(...fontTypes);
}

// Fonts definitely not present on a computer -- we simply use UUIDs. These
// should be kept in sync with the ones in *-prefs.js.
var kFakeFonts = {
  "serif": "bc7e8c62-0634-467f-a029-fe6abcdf1582",
  "sans-serif": "419129aa-43b7-40c4-b554-83d99b504b89",
  "monospace": "348df6e5-e874-4d21-ad4b-359b530a33b7",
};

/**
 * Test that for a particular language, if font.name.<type>.<language> is not
 * present on the computer, we fall back to displaying what's in
 * font.name-list.<type>.<language>.
 */
function test_font_name_not_present() {
  Services.prefs.setCharPref("font.language.group", kLanguage);

  // The fonts we're expecting to see selected in the font chooser for
  // test_font_name_not_present.
  let expected = {};
  for (let [fontType, fakeFont] of Object.entries(kFakeFonts)) {
    // Look at the font.name-list. We need to verify that the first font is the
    // fake one, and that the second one is present on the user's computer.
    let listPref = "font.name-list." + fontType + "." + kLanguage;
    let fontList = Services.prefs.getCharPref(listPref);
    let fonts = fontList.split(",").map(font => font.trim());
    if (fonts.length != 2)
      throw new Error(listPref + " should have exactly two fonts, but it is " +
                      fontList + ".");

    if (fonts[0] != fakeFont)
      throw new Error("The first font in " + listPref + " should be " + fakeFont +
                      ", but is actually " + fonts[0] + ".");

    if (!gRealFontLists[fontType].includes(fonts[1]))
      throw new Error("The second font in " + listPref + " (" + fonts[1] +
                      ") should be present on this computer, but isn't.");
    expected[fontType] = fonts[1];

    // Set font.name to be the fake font. font.name-list is handled by
    // wrapper.py.
    Services.prefs.setCharPref("font.name." + fontType + "." + kLanguage, fakeFont);
  }

  let fontTypes = kFontTypes.map(fontType => expected[fontType]);
  _verify_fonts_displayed(...fontTypes);
}
