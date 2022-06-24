function test_full() {
    var date = new Date();
    var scriptableDateServ =
    Cc["@mozilla.org/intl/scriptabledateformat;1"].createInstance(Ci.nsIScriptableDateFormat);

    var dateStrXpcom = scriptableDateServ.FormatDateTime("",
    scriptableDateServ.dateFormatLong, scriptableDateServ.timeFormatSeconds,
    date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(),
    date.getMinutes(), date.getSeconds());

    var dateStrJs = date.toLocaleString();

    Assert.equal(dateStrXpcom, dateStrJs);

}

function test_kTimeFormatSeconds() {
    var date = new Date();
    var scriptableDateServ =
    Cc["@mozilla.org/intl/scriptabledateformat;1"].createInstance(Ci.nsIScriptableDateFormat);

    var dateStrXpcom = scriptableDateServ.FormatDateTime("",
    scriptableDateServ.dateFormatLong, scriptableDateServ.timeFormatNone,
    date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(),
    date.getMinutes(), date.getSeconds());

    var dateStrJs = date.toLocaleDateString()

    Assert.equal(dateStrXpcom, dateStrJs);

}

function run_test()
{
    // XXX test disabled due to bug 421790
    return;
    test_full();
    test_kTimeFormatSeconds();
}
