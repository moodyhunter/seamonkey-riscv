/* Test that nsMsgDBView properly reports the values of messages in the display.
 */
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/abSetup.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

var ViewType = Ci.nsMsgViewType;
var SortType = Ci.nsMsgViewSortType;
var SortOrder = Ci.nsMsgViewSortOrder;

// This is an array of the actual test data. Each test datum is an array of two
// elements: the first element is the argument into a simple message generator,
// and the second element is a map of column names to expected values when
// requesting the cell text for a given column name.
var tests = [
  [{from: "John Doe <db@tinderbox.invalid>"}, {sender: "John Doe"}],
  [{from: "\"Doe, John\" <db@tinderbox.invalid>"}, {sender: "Doe, John"}],
  [{from: "John Doe <db@tinderbox.invalid>, Sally Ann <db@null.invalid>"},
    {sender: "John Doe"}],
  [{from: "=?UTF-8?Q?David_H=C3=A5s=C3=A4ther?= <db@null.invalid>"},
    {sender: "David Håsäther"}],
  [{from: "=?UTF-8?Q?H=C3=A5s=C3=A4ther=2C_David?= <db@null.invalid>"},
    {sender: "Håsäther, David"}],
  [{from: "\"Håsäther, David\" <db@null.invalid>"},
    {sender: "Håsäther, David"}],
  [{from: "David Håsäther <db@null.invalid>"},
    {sender: "David Håsäther"}],
  [{from: "\xC2\xAB\xCE\xA0\xCE\x9F\xCE\x9B\xCE\x99\xCE\xA4\xCE\x97\xCE\xA3\xC2\xBB"},
    {sender: "«ΠΟΛΙΤΗΣ»"}],
  [{from: "John Doe \xF5  <db@null.invalid>",
     clobberHeaders: { "Content-type" : "text/plain; charset=ISO-8859-1" }},
	{sender: "John Doe õ"}],
  [{from: "John Doe \xF5 <db@null.invalid>",
     clobberHeaders: { "Content-type" : "text/plain; charset=ISO-8859-2" }},
	{sender: "John Doe ő"}],
  [{from: "=?UTF-8?Q?H=C3=A5s=C3=A4ther=2C_David?= <db@null.invalid>",
     clobberHeaders: { "Content-type" : "text/plain; charset=ISO-8859-2" }},
    {sender: "Håsäther, David"}],
];

function* real_test() {
  // Add the messages to the folder
  let msgGenerator = new MessageGenerator();
  let genMessages = tests.map(data => msgGenerator.makeMessage(data[0]));
  let folder = make_empty_folder();
  yield add_sets_to_folder(folder, [new SyntheticMessageSet(genMessages)]);

  // Make the DB view
  let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=threaded";
  let dbView = Cc[dbviewContractId]
                 .createInstance(Ci.nsIMsgDBView);
  dbView.init(null, null, null);
  var outCount = {};
  dbView.open(folder, SortType.byDate, SortOrder.ascending, 0, outCount);

  // Did we add all the messages properly?
  let treeView = dbView.QueryInterface(Ci.nsITreeView);
  Assert.equal(treeView.rowCount, tests.length);

  // For each test, make sure that the display is correct.
  tests.forEach(function (data, i) {
    info("Checking data for " + uneval(data));
    let expected = data[1];
    for (let column in expected) {
      Assert.equal(dbView.cellTextForColumn(i, column), expected[column]);
    }
  });
}

function run_test() {
  configure_message_injection({mode: "local"});
  async_run_tests([real_test]);
}
