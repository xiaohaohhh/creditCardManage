const { execSync } = require('child_process');

try {
  console.log("Git Status:");
  console.log(execSync('git status').toString());
} catch (e) {
  console.log("Not a git repository, initializing...");
  execSync('git init');
  console.log("Git repository initialized.");
}
