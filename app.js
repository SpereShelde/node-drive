const readLine = require('readline')
const NodeDrive = require('./node-drive');
const nodeDrive = new NodeDrive();

const nodeFace = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'node-drive> '
})

nodeFace.on('line', async (line) => {
  try {
    const params = line.trim().split(/\s+/);
    const cmd = params[0];
    switch (cmd) {
      default:
        break;
      case 'h':
      case 'help':
        console.log(help);
        break;
      case 'a':
      case 'auth':
        const code = params[1];
        if (!code) {
          console.log('Please visit the link below via your browser, copy the code and then type "a YOUR_CODE".\n');
          console.log(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${nodeDrive.clientId}&response_type=code&scope=files.readwrite+offline_access+files.read+files.read.all+files.readwrite.all&redirect_uri=${nodeDrive.redirectUri}`)
        } else {
          const suc = await nodeDrive.login(code);
          if (suc) {
            console.log('OneDrive connected!');
          } else {
            console.log('Failed to connect OneDrive! Please try again.');
          }
        }
        break;
      case 'up':
        if (line.indexOf('->') === -1) {
          console.log('Wrong params.');
        } else {
          const upParams = line.substring(2, line.length).split('->');
          nodeDrive.newTask('up', upParams[0].trim(), upParams[1].trim());
        }
        break;
      case 'up-d':
        if (line.indexOf('->') === -1) {
          console.log('Wrong params.');
        } else {
          const upParams = line.substring(4, line.length).split('->');
          nodeDrive.newTask('up-d', upParams[0].trim(), upParams[1].trim());
        }
        break;
      case 'set':
        nodeDrive.set(params[1], params[2], params[3]);
        console.log('Done');
        break;
      case 'thread':
        nodeDrive.setThread(params[1]);
        console.log('Done');
        break;
      case 'check':
        const status = nodeDrive.status();
        if (!status.connected) {
          console.log('OneDrive disconnected!');
        } else {
          console.log(`Uploading threads / Max threads: ${status.threads} / ${status.maxThreads}`);
          console.log(`${status.activeUploads.length} active uploads:`);
          if (status.activeUploads.length > 0) {
            status.activeUploads.forEach((up) => {
              console.log(up.localPath);
            })
          } else {
            console.log('Null');
          }
          console.log(`${status.pendingUploads.length} pending uploads:`);
          if (status.pendingUploads.length > 0) {
            status.pendingUploads.forEach((up) => {
              console.log(up.localPath);
            })
          }
        }
        break;
      case 'exit':
        process.exit();
        break;
    }
    nodeFace.prompt();
  } catch (e) {
    console.log('An error occurred. Restart node-drive is not required but recommended.')
    nodeFace.prompt();
  }
})

const help = "Options:\n" +
  "COMMAND\t\tPARAMS\t\t\t\tFUNCTION\n" +
  "\n" +
  "h, help\t\t\t\t\t\tget command list\n" +
  "a, auth\t\t\t\t\t\tlogin to OneDrive\n" +
  "set\t\t[id, secret, uri]\t\tset configuration\n" +
  "up\t\tlocFilePath -> remoFilePath\tupload file to OneDrive\n" +
  "up-d\t\tlocDirPath  -> remoDirPath\tupload directory and files in it to OneDrive\n" +
  "thread\t\tnumber\t\t\t\tset max number of uploading threads\n" +
  "check\t\t\t\t\t\tcheck node-drive status";

console.log('Welcome to node-drive. Type "help" or "h" for command list.')
console.log(help);
nodeFace.prompt();