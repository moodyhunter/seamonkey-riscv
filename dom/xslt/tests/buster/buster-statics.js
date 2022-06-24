/* -*- indent-tabs-mode: nil; js-indent-level: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// helper function to shortcut component creation
function doCreate(aContract, aInterface)
{
    return Cc[aContract].createInstance(aInterface);
}

// for the items, loading a text file
const IOSERVICE_CTRID = "@mozilla.org/network/io-service;1";
const nsIIOService    = Ci.nsIIOService;
const SIS_CTRID       = "@mozilla.org/scriptableinputstream;1"
const nsISIS          = Ci.nsIScriptableInputStream;

// rdf foo, onload handler
const kRDFSvcContractID = "@mozilla.org/rdf/rdf-service;1";
const kRDFInMemContractID = 
    "@mozilla.org/rdf/datasource;1?name=in-memory-datasource";
const kRDFContUtilsID = "@mozilla.org/rdf/container-utils;1";
const kRDFXMLSerializerID = "@mozilla.org/rdf/xml-serializer;1";
const kIOSvcContractID  = "@mozilla.org/network/io-service;1";
const kStandardURL = Cc["@mozilla.org/network/standard-url;1"];
const nsIURL = Ci.nsIURL;
const nsIStandardURL = Ci.nsIStandardURL;
const nsIFilePicker = Ci.nsIFilePicker;
const nsIXULTreeBuilder = Ci.nsIXULTreeBuilder;
const nsIXULTemplateBuilder = Ci.nsIXULTemplateBuilder;
const kIOSvc = Cc[kIOSvcContractID]
    .getService(Ci.nsIIOService);
const nsIRDFService = Ci.nsIRDFService;
const nsIRDFDataSource = Ci.nsIRDFDataSource;
const nsIRDFRemoteDataSource = Ci.nsIRDFRemoteDataSource;
const nsIRDFPurgeableDataSource =
    Ci.nsIRDFPurgeableDataSource;
const nsIRDFResource = Ci.nsIRDFResource;
const nsIRDFLiteral = Ci.nsIRDFLiteral;
const nsIRDFInt = Ci.nsIRDFInt;
const nsIRDFContainerUtils = Ci.nsIRDFContainerUtils;
const nsIRDFXMLSerializer = Ci.nsIRDFXMLSerializer;
const nsIRDFXMLSource = Ci.nsIRDFXMLSource;
const kRDFSvc =
    Cc[kRDFSvcContractID].getService(nsIRDFService);
const krTypeCat = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#category");
const krTypeFailCount = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#failCount");
const krTypeName = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#name");
const krTypeSucc = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#succ");
const krTypeOrigSucc = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#orig_succ");
const krTypeOrigFailCount = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#orig_failCount");
const krTypeOrigSuccCount = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#orig_succCount");
const krTypePath = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#path");
const krTypeParent = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#parent");
const krTypePurp = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#purp");
const krTypeSuccCount = kRDFSvc.GetResource("http://home.netscape.com/NC-rdf#succCount");
const kGood  = kRDFSvc.GetLiteral("yes");
const kBad   = kRDFSvc.GetLiteral("no");
const kMixed = kRDFSvc.GetLiteral("+-");
const kContUtils = doCreate(kRDFContUtilsID, nsIRDFContainerUtils);

function doCreateRDFFP(aTitle, aMode)
{
    var fp = doCreate("@mozilla.org/filepicker;1", nsIFilePicker);
    fp.init(window, aTitle, aMode);
    fp.appendFilter('*.rdf', '*.rdf');
    fp.appendFilters(nsIFilePicker.filterAll);
    return fp;
}

function goDoCommand(aCommand)
{
    try {
        var controller = 
            top.document.commandDispatcher.getControllerForCommand(aCommand);
        if (controller && controller.isCommandEnabled(aCommand))
            controller.doCommand(aCommand);
    }
    catch(e) {
        dump("An error "+e+" occurred executing the "+aCommand+" command\n");
    }
}

function registerController(aController)
{
    top.controllers.appendController(aController);
}
