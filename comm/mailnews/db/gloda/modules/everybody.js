/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = [];

ChromeUtils.import("resource:///modules/gloda/log4moz.js");

var LOG = Log4Moz.repository.getLogger("gloda.everybody");

var importNS = {};

function loadModule(aModuleURI, aNSContrib) {
  try {
    LOG.info("... loading " + aModuleURI);
    ChromeUtils.import(aModuleURI, importNS);
  }
  catch (ex) {
    LOG.error("!!! error loading " + aModuleURI);
    LOG.error("(" + ex.fileName + ":" + ex.lineNumber + ") " + ex);
    return false;
  }
  LOG.info("+++ loaded " + aModuleURI);

  if (aNSContrib) {
    try {
      importNS[aNSContrib].init();
    }
    catch (ex) {
      LOG.error("!!! error initializing " + aModuleURI);
      LOG.error("(" + ex.fileName + ":" + ex.lineNumber + ") " + ex);
      return false;
    }
    LOG.info("+++ inited " + aModuleURI);
  }
  return true;
}

loadModule("resource:///modules/gloda/fundattr.js", "GlodaFundAttr");
loadModule("resource:///modules/gloda/explattr.js", "GlodaExplicitAttr");

loadModule("resource:///modules/gloda/noun_tag.js");
loadModule("resource:///modules/gloda/noun_freetag.js");
loadModule("resource:///modules/gloda/noun_mimetype.js");
loadModule("resource:///modules/gloda/index_msg.js");
loadModule("resource:///modules/gloda/index_ab.js", "GlodaABAttrs");
