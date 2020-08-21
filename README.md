# dash-inspector

Web client to play video based on dashjs. It allows basic monitoring and log the playback session.

## What it does

dash-inspector is a simple web client to reproduce dash video. The web client summarizes a couple of playbac metrics such as: played representation, bitrate estimation, size and downloading time of each segment.

Additionally, a  log file with the playback session is available to download using `Download Playback` button. This log file contains all the URLs of the video segments during the playback.

The downloaded file can be used with [getDashMediafiles.py](https://github.com/gdavila/vmafUtils) to download all the representation availables on the manifest during the playback.

## How to use it

Just clone the repo and install it using  `node`

```console
$ node app.js
Running at Port 3000
```

The webclient will be available at `http://localhost:3000`
