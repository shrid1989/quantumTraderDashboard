const fs = require('fs');

async function testParse() {
  const fileContent = fs.readFileSync('/tmp/test.csv', 'utf8');
  console.log("Read test.csv");
  console.log(fileContent.substring(0, 100) + "...");
}
testParse();
