// src: http://ir-apps.kutu.ru/libs/ir/ir.coffee

var IRacing,
  indexOf = [].indexOf;

window.IRacing = IRacing = class IRacing {
  constructor(requestParams = [], requestParamsOnce = [], fps = 1, server = '127.0.0.1:8182', readIbt = false, record = null, zipLibPath = null) {
    this.requestParams = requestParams;
    this.requestParamsOnce = requestParamsOnce;
    this.fps = fps;
    this.server = server;
    this.readIbt = readIbt;
    this.record = record;
    this.zipLibPath = zipLibPath;
    this.data = {};
    this.onConnect = null;
    this.onDisconnect = null;
    this.onUpdate = null;
    this.onBroadcast = null;
    this.ws = null;
    this.onWSConnect = null;
    this.onWSDisconnect = null;
    this.reconnectTimeout = null;
    this.connected = false;
    this.firstTimeConnect = true;
    if (this.record != null) {
      this.loadRecord();
    }
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(`ws://${this.server}/ws`);
    this.ws.onopen = (...args) => {
      return this.onopen(...args);
    };
    this.ws.onmessage = (...args) => {
      return this.onmessage(...args);
    };
    return this.ws.onclose = (...args) => {
      return this.onclose(...args);
    };
  }

  close() {
    this.ws.onclose = null;
    return this.ws.close();
  }

  onopen() {
    var k;
    if (typeof this.onWSConnect === "function") {
      this.onWSConnect();
    }
    if (this.reconnectTimeout != null) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.record == null) {
      for (k in this.data) {
        delete this.data[k];
      }
      return this.ws.send(JSON.stringify({
        fps: this.fps,
        readIbt: this.readIbt,
        requestParams: this.requestParams,
        requestParamsOnce: this.requestParamsOnce
      }));
    }
  }

  onmessage(event) {
    var data, k, keys, ref, v;
    // data = JSON.parse event.data.replace /\bNaN\b/g, 'null'
    data = JSON.parse(event.data);
    if (this.record == null) {
      // on disconnect
      if (data.disconnected) {
        this.connected = false;
        if (typeof this.onDisconnect === "function") {
          this.onDisconnect();
        }
      }
      // clear data on connect
      if (data.connected) {
        for (k in this.data) {
          delete this.data[k];
        }
      }
      // on connect or first time connect
      if (data.connected || (this.firstTimeConnect && !this.connected)) {
        this.firstTimeConnect = false;
        this.connected = true;
        if (typeof this.onConnect === "function") {
          this.onConnect();
        }
      }
      // update data
      if (data.data) {
        keys = [];
        ref = data.data;
        for (k in ref) {
          v = ref[k];
          keys.push(k);
          this.data[k] = v;
        }
        if (typeof this.onUpdate === "function") {
          this.onUpdate(keys);
        }
      }
    }
    // broadcast message
    if (data.broadcast) {
      return typeof this.onBroadcast === "function" ? this.onBroadcast(data.broadcast) : void 0;
    }
  }

  onclose() {
    if (typeof this.onWSDisconnect === "function") {
      this.onWSDisconnect();
    }
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = null;
    }
    if (this.connected) {
      this.connected = false;
      if (this.record == null) {
        if (typeof this.onDisconnect === "function") {
          this.onDisconnect();
        }
      }
    }
    return this.reconnectTimeout = setTimeout((() => {
      return this.connect.apply(this);
    }), 2000);
  }

  sendCommand(command, ...args) {
    return this.ws.send(JSON.stringify({
      command: command,
      args: args
    }));
  }

  broadcast(data) {
    return this.ws.send(JSON.stringify({
      broadcast: data
    }));
  }

  loadRecord() {
    var isZip, r;
    isZip = this.zipLibPath && this.record.search(/\.zip$/i) !== -1;
    r = new XMLHttpRequest;
    r.onreadystatechange = () => {
      var head, zipSrc;
      if (r.readyState === 4 && r.status === 200) {
        if (isZip) {
          head = document.head;
          zipSrc = document.createElement('script');
          zipSrc.src = this.zipLibPath + 'zip.js';
          head.appendChild(zipSrc);
          return zipSrc.addEventListener('load', () => {
            var inflateSrc;
            zip.useWebWorkers = false;
            inflateSrc = document.createElement('script');
            inflateSrc.src = this.zipLibPath + 'inflate.js';
            head.appendChild(inflateSrc);
            return inflateSrc.addEventListener('load', () => {
              return zip.createReader(new zip.BlobReader(r.response), (zipReader) => {
                return zipReader.getEntries((entry) => {
                  return entry[0].getData(new zip.TextWriter, (text) => {
                    zipReader.close();
                    head.removeChild(inflateSrc);
                    head.removeChild(zipSrc);
                    return this.onRecord(JSON.parse(text));
                  });
                });
              });
            });
          });
        } else {
          return this.onRecord(r.response);
        }
      }
    };
    r.open('GET', this.record, true);
    r.responseType = isZip ? 'blob' : 'json';
    return r.send();
  }

  onRecord(frames) {
    this.connected = true;
    if (!('connected' in frames[0])) {
      frames.unshift({
        connected: true
      });
    }
    this.record = {
      frames: frames,
      requestedParamsOnce: []
    };
    return typeof this.onConnect === "function" ? this.onConnect() : void 0;
  }

  playRecord(startFrame = 0, stopFrame = null, speed = 1) {
    var i;
    this.record.currentFrame = 0;
    if (typeof this.onConnect === "function") {
      this.onConnect(false);
    }
    i = startFrame;
    while (i-- >= 0) {
      this.record.currentFrame++;
      this.playRecordFrame(false);
    }
    if (this.record.playInterval != null) {
      clearInterval(this.record.playInterval);
    }
    if (!speed || ((stopFrame != null) && startFrame >= stopFrame)) {
      if (this.record.currentFrame < this.record.frames.length - 1) {
        return setTimeout(() => {
          this.record.currentFrame++;
          return this.playRecordFrame();
        }, 1);
      }
    } else {
      return this.record.playInterval = setInterval(() => {
        if (this.record.currentFrame < this.record.frames.length - 1 && !((stopFrame != null) && this.record.currentFrame >= stopFrame)) {
          this.record.currentFrame++;
          return this.playRecordFrame();
        } else {
          return clearInterval(this.record.playInterval);
        }
      }, 1000 / speed);
    }
  }

  resetRecord() {
    if (this.record.playInterval != null) {
      clearInterval(this.record.playInterval);
    }
    return setTimeout(() => {
      var k;
      this.record.requestedParamsOnce = [];
      for (k in this.data) {
        delete this.data[k];
      }
      if (typeof this.onDisconnect === "function") {
        this.onDisconnect();
      }
      return setTimeout(() => {
        return typeof this.onConnect === "function" ? this.onConnect() : void 0;
      }, 500);
    }, 100);
  }

  playRecordFrame(update = true) {
    var data, k, keys, ref, v;
    data = this.record.frames[this.record.currentFrame];
    if (data != null ? data.data : void 0) {
      keys = [];
      ref = data.data;
      for (k in ref) {
        v = ref[k];
        if (indexOf.call(this.requestParams, '__all_telemetry__') >= 0 || indexOf.call(this.requestParams, k) >= 0 || (indexOf.call(this.requestParamsOnce, k) >= 0 && indexOf.call(this.record.requestedParamsOnce, k) < 0)) {
          keys.push(k);
          this.data[k] = v;
          if (indexOf.call(this.requestParamsOnce, k) >= 0 && indexOf.call(this.record.requestedParamsOnce, k) < 0) {
            this.record.requestedParamsOnce.push(k);
          }
        }
      }
      return typeof this.onUpdate === "function" ? this.onUpdate(keys, update) : void 0;
    }
  }

};
