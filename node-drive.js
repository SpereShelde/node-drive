const fs = require('fs');
const path = require('path');
const axios = require('axios');

class NodeDrive {
  constructor() {
    this.clientId = '21f4a71f-6ec6-4d9a-ab3b-4a965d575fb5';
    this.clientSecret = 'tTL7qoemU7XS2W4-w.0R2kD-CDbhe2~7cw';
    this.redirectUri = 'https://s.gkd.wtf';
    this.maxThreads = 5;
    this.pendingUploads = [];
    this.activeUploads = [];
    this.activeSimpleUploadNumber = 0;
    this.nextRefresh = -1;
    this.exit = false;
  }

  status() {
    return {
      connected: this.nextRefresh > Date.now(),
      threads: this.activeUploads.length,
      maxThreads: this.maxThreads,
      pendingUploads: this.pendingUploads,
      activeUploads: this.activeUploads,
    }
  }

  dev(acc) {
    this.access_token = acc;
    this.nextRefresh = Date.now() + 30 * 60 * 1000;
  }

  set(id, secret, uri) {
    this.clientId = id || '21f4a71f-6ec6-4d9a-ab3b-4a965d575fb5';
    this.clientSecret = secret || 'rm9~30sdiqv_2oYm9NcgyU2X4T2.q.KC-r';
    this.redirectUri = uri || 'https://s.gkd.wtf';
  }

  setThread(thread) {
    this.maxThreads = thread || 5;
  }

  async login(code, refresh = false) {
    let body;
    if (refresh) {
      body = `client_id=${this.clientId}&refresh_token=${this.refresh_token}&redirect_uri=${this.redirectUri}&grant_type=refresh_token&client_secret=${this.clientSecret}`;
    } else {
      body = `client_id=${this.clientId}&code=${code}&redirect_uri=${this.redirectUri}&grant_type=authorization_code&client_secret=${this.clientSecret}`;
    }
    try {
      const { data } = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', body);
      if (!data) {
        return false;
      }
      this.access_token = data.access_token;
      this.refresh_token = data.refresh_token;
      const { expires_in } = data;
      console.log('expires_in', expires_in);
      this.nextRefresh = Date.now() + expires_in * 1000;
      if (!refresh) {
        setTimeout(() => {
          this.work();
        }, 500);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async work() {
    if (this.exit === true) {
      if (this.activeUploads === 0) {
        process.exit();
      }
      return;
    }
    // repeatedly check this.pendingUploads and load the task
    if (this.nextRefresh < Date.now() + 20 * 60 * 1000 && this.activeSimpleUploadNumber === 0) {
      let connected = await this.login('',true);
      let reconnectChances = 3;
      while (!connected && reconnectChances > 0) {
        connected = await this.login('', true);
        reconnectChances -= 1;
      }
      if (!connected) {
        console.log('Cannot refresh token. Will exit when finish all tasks.');
        this.exit = true;
      } else {
        console.log('Token refreshed.', Date.now());
      }
      setTimeout(() => {
        this.work();
      }, 500);
      return;
    }
    if (this.activeUploads.length >= this.maxThreads || this.pendingUploads.length === 0) {
      setTimeout(() => {
        this.work();
      }, 10000);
      return;
    }
    const nextUpload = this.pendingUploads.shift();
    if (nextUpload.type === 'simple' && this.nextRefresh < Date.now() + 10 * 60 * 1000) {
      this.pendingUploads.push(nextUpload);
      if (this.pendingUploads.every((up) => up.type === 'simple')) {
        setTimeout(() => {
          this.work();
        }, 10000);
      } else {
        setTimeout(() => {
          this.work();
        }, 500);
      }
      return;
    }
    this.start(nextUpload);
    setTimeout(() => {
      this.work();
    }, 500);
  }

  async start(upload) {
    // actually start the upload task
    const { type } = upload;
    if (type === 'simple') {
      this.activeUploads.push(upload);
      this.activeSimpleUploadNumber += 1;
      await this.simpleUpload(upload.localPath, upload.remotePath);
    } else if (type === 'up') {
      this.activeUploads.push(upload);
      await this.uploadFile(upload.localPath, upload.remotePath, upload.size)
    }
  }

  newTask(type, localPath, remotePath) {
    //  add uploads to this.pendingUploads
    if (type === 'up') {
      const stat = fs.statSync(localPath);
      if (remotePath.endsWith('/')) {
        remotePath += localPath.substring(localPath.lastIndexOf('/') + 1, localPath.length);
      }
      if (stat.size <= 4 * 1024 * 1024) {
        //  simple upload
        this.pendingUploads.push({
          type: 'simple',
          localPath,
          remotePath,
        })
      } else {
        this.pendingUploads.push({
          type: 'up',
          localPath,
          remotePath,
          size: stat.size,
        })
      }
    } else if (type === 'up-d') {
      fs.readdir(localPath, {
        'withFileTypes': true,
      }, (err, files) => {
        files.forEach((file) => {
          if (file.isDirectory()) {
            this.newTask('up-d', path.resolve(localPath, file.name), `${remotePath}/${file.name}`);
          } else {
            this.newTask('up', path.resolve(localPath, file.name), `${remotePath}/${file.name}`);
          }
        })
      })
    }
  }

  async uploadFile(localPath, remotePath, size) {
    const url = await this.createUploadSession(localPath, remotePath);
    if (url) {
      this.upload(localPath, url, 0, Math.min(10 * 1024 * 1024 - 1, size - 1), size);
    } else {
      // console.log('Cannot get upload URL of', localPath)
      this.activeUploads = this.activeUploads.filter((ups) => ups.localPath !== localPath);
    }
  }

  async simpleUpload(localPath, remotePath) {
    try {
      const file = fs.createReadStream(localPath);
      await axios.put(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(remotePath)}:/content`, file, {
        headers: { Authorization: `Bearer ${this.access_token}` }
      });
      console.log('Completed simple upload', localPath);
      this.activeUploads = this.activeUploads.filter((ups) => ups.localPath !== localPath);
      this.activeSimpleUploadNumber -= 1;
    } catch (e) {
      console.log('Failed simple upload', localPath);
      this.activeUploads = this.activeUploads.filter((ups) => ups.localPath !== localPath);
      this.activeSimpleUploadNumber -= 1;
    }
  }

  async createUploadSession(localPath, remotePath) {
    try {
      const { data } = await axios.post(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(remotePath)}:/createUploadSession`, {
        "@microsoft.graph.conflictBehavior": "fail",
        "fileSystemInfo": {"@odata.type": "microsoft.graph.fileSystemInfo"},
      }, {
        headers: {
          Authorization: `Bearer ${this.access_token}`
        }
      });
      const { uploadUrl } = data;
      return uploadUrl;
    } catch (e) {
      return null;
    }
  }

  async upload(file, url, start, end, size) {
    try {
      await axios.put(url, fs.createReadStream(file, { start, end }), {
        headers: {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': `${end - start + 1}`,
        },
      });
      if (end !== size - 1) {
        setTimeout(() => {
          this.upload(file, url, end, Math.min(end + 10 * 1024 * 1024 - 1, size - 1), size);
        }, 100)
      } else {
        console.log('Completed upload', file)
        this.activeUploads = this.activeUploads.filter((ups) => ups.localPath !== file);
      }
    } catch (e) {
      console.log('Failed upload', file)
      this.activeUploads = this.activeUploads.filter((ups) => ups.localPath !== file);
    }
  }
}

module.exports = NodeDrive;
