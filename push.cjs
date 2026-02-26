const { execSync } = require('child_process');

function run(cmd) {
  try {
    console.log(`> ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
    if (output) console.log(output);
  } catch (e) {
    console.error(`Error executing ${cmd}:`, e.message);
  }
}

console.log("=== 初始化Git仓库并推送 ===");
run('git init');
run('git add .');
run('git status');
run('git commit -m "feat: initial commit for Credit Card Management App"');
run('git branch -M main');
run('git remote add origin https://github.com/xiaohaohhh/creditCardManage.git');
run('git remote -v');
run('git push -u origin main');
console.log("=== 完成 ===");
