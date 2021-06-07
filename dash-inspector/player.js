
// player
let video, player, controlbar, dashMetrics, mpd;

//Google charts
let dataProfiles, dataBitrate, dataThroughput1, dataThroughput2, dataSegmentSize, lowlatency= false,bytesTotal;

// video metrics and info
let mediaFilesInfo=[], MediaSegments=0, interval, streamInfo,src, firstSegment=true, initTime;
let lastDecodedByteCount=0,bufferLevel, lastSegmentDuration, lastStartTime, videoBitrate=0, bitrate=0, downloadTime=0;

//Downloader
let server

function init() {
  //initializing the player
  setServer();

  player = dashjs.MediaPlayer().create();
  player.updateSettings({ 'streaming': { 'lowLatencyEnabled': false }});
  player.updateSettings({'debug': {'logLevel': dashjs.Debug.LOG_LEVEL_NONE }});
  player.initialize();

  //initializing the video container
  video = document.querySelector(".videoContainer video");
  player.attachView(video)
  url = document.getElementById('srcUrl').value;
  player.attachSource(url);

  //initializing Akamai control bar
  controlbar = new ControlBar(player);
  controlbar.initialize();

  //initializing trace textbox
  document.getElementById("trace").innerHTML = ""; 

  //initializing google charts
  google.charts.load('current', {'packages':['corechart', 'line']});
  google.charts.setOnLoadCallback(initializeChart);

  //poller interval to update metrics (seconds)
  interval = 2;
  let eventPoller = setInterval(updateMetrics,interval*1000);

  // event handler: it handles when a A/V segment is full loaded
  player.on(dashjs.MediaPlayer.events['FRAGMENT_LOADING_COMPLETED'],showEvent);
  player.on(dashjs.MediaPlayer.events['MANIFEST_LOADED'],showEvent);



}
          
function restartPlayback() {
    mediaFilesInfo=[];
    MediaSegments=0;
    lastDecodedByteCount=0;
    firstSegment=true;
    controlbar.reset();
    url = document.getElementById('srcUrl').value;
    player.attachSource(url);
    if (lowlatency){
      player.updateSettings({'streaming': {'lowLatencyEnabled': true}});
      player.updateSettings({'streaming': {    'liveDelay': 3   }});
    } else {
        player.updateSettings({'streaming': {'lowLatencyEnabled': false}});
      }
    google.charts.setOnLoadCallback(initializeChart);
    log("userEvent", "Video loaded")
}


function updateMetrics(){
  dashMetrics = player.getDashMetrics();
  dashAdapter = player.getDashAdapter();
  streamInfo = player.getActiveStream().getStreamInfo();
  if (dashMetrics) {
    bufferLevel = dashMetrics.getCurrentBufferLevel('video');
  }
  document.getElementById('bufferLevel').innerText = bufferLevel + " secs";

  /*
  if (video.webkitVideoDecodedByteCount !== undefined && lowlatency) {
    videoBitrate = (((video.webkitVideoDecodedByteCount - lastDecodedByteCount) / 1000) * 8) / interval;
    lastDecodedByteCount = video.webkitVideoDecodedByteCount;
    plot_bitrate();
  } */

}

function plotBitrate(){
  if (!isNaN(lastStartTime) && !isNaN(videoBitrate) && !isNaN(bitrate)){
    if (firstSegment===true) {
      initTime = lastStartTime;
      firstSegment=false;
    };

    if (dataBitrate!=undefined){
      dataBitrate.addRow([lastStartTime-initTime, Math.round(videoBitrate), bitrate]);
      if (dataBitrate.getNumberOfRows() > 200){ dataBitrate.removeRow(0); }

      chartBitrate.draw(dataBitrate,{
        title: 'Bitrate',
        hAxis: {title: 'timestamp'},
        vAxis: {title: 'Kbps'},
        legend: { position: 'bottom', alignment: 'end' },
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });
    }
  }
  
}

function updatePlaybackLogs(){
  if (dashMetrics!=null  && streamInfo!=null ){
    const periodIdx = streamInfo.index;
    var repSwitch = dashMetrics.getCurrentRepresentationSwitch('video', true);
    bitrate = repSwitch ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000) : NaN;   
    var adaptation = dashAdapter.getAdaptationForType(periodIdx, 'video', streamInfo)
    var frameRate = adaptation.Representation_asArray.find(function (rep) {
      return rep.id === repSwitch.to
    }).frameRate;

    document.getElementById('framerate').innerText = frameRate + " fps";

    // quality Index of video played
    let qIndex = player.getQualityFor('video')
    let qDetails = player.getBitrateInfoListFor("video")[qIndex]
    document.getElementById('lastSegmentDuration').innerText = lastSegmentDuration;
    document.getElementById('lastStartTime').innerText = lastStartTime;
    document.getElementById('currentQuality').innerText = '[id: '+repSwitch.to+'][index: ' + qIndex + ']';
    document.getElementById('MediaSegments').innerText = '['+MediaSegments+']';


    if (typeof qDetails !== 'undefined') {
      document.getElementById('currentBitrate').innerText = bitrate + ' kbps @ ' + qDetails.width + 'x' + qDetails.height ; }
    if (!video.paused && bufferLevel){

      // Plot current profile index vs date
      var color = "#0070cc";
      dataProfiles.addRow([new Date(), qIndex, 'Buffer = ' + bufferLevel + 's','point {fill-color: ' + color + '}']);
      if (dataProfiles.getNumberOfRows() > 200){
        dataProfiles.removeRow(0); }
      chartProfiles.draw(dataProfiles, {
        title: 'Quality Index',
        hAxis: {title: 'Local Time'},
        vAxis: {title: 'Index'},
        legend: 'none',
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });

      // Segment Size (bytesTotal) vs Downloading Time
      let throughput= (bytesTotal*8*1000)/(downloadTime*1000000) //Mbps
      dataThroughput1.addRow([downloadTime, bytesTotal*8/1000]);
      dataThroughput2.addRow([new Date(), throughput ]);
      dataSegmentSize.addRow([bytesTotal*8/1000000]);

      if (dataThroughput1.getNumberOfRows() > 200){
        dataThroughput1.removeRow(0); 
        dataSegmentSize.removeRow(0);
      }

      chartThroughput1.draw(dataThroughput1, { 
        title: 'Segment Size vs downloading time',
        hAxis: {title: 'downloading time [ms]'},
        vAxis: {title: 'Segment Size [MB]'},
        legend: 'none',
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });

      chartThroughput2.draw(dataThroughput2, { 
        title: 'Throughput',
        hAxis: {title: 'timestamp'},
        vAxis: {title: 'Mbps', scaleType: 'log'},
        legend: 'none',
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });

      chartSegmentSize.draw(dataSegmentSize, {
        title: 'Segment Size | Histogram',
        hAxis: {title: '[MB]'},
        vAxis: {title: 'Count'},
        legend: 'none',
        histogram: { lastBucketPercentile: 20},
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });

    } 
  }
}

function initializeChart() {
    dataProfiles = new google.visualization.DataTable();
    dataProfiles .addColumn('date', 'Time');
    dataProfiles .addColumn('number', 'Quality Index');
    dataProfiles .addColumn({'type':'string', 'role':'tooltip'}); 
    dataProfiles .addColumn({'type': 'string', 'role': 'style'});
    chartProfiles = new google.visualization.LineChart(document.getElementById('chart_profiles'));
    
    dataBitrate = new google.visualization.DataTable();
    dataBitrate .addColumn('number', 'timestamp');
    dataBitrate .addColumn('number', 'video bitrate');
    dataBitrate .addColumn('number', 'profile bitrate');
    chartBitrate = new google.visualization.LineChart(document.getElementById('chart_bitrate'));
    google.visualization.events.addListener(chartBitrate, 'error', function (err) {
      google.visualization.errors.removeError(err.id);
    });

    dataThroughput1 = new google.visualization.DataTable();
    dataThroughput1 .addColumn('number', 'Segment Download Time');
    dataThroughput1 .addColumn('number', 'Segment Size');
    chartThroughput1 = new google.visualization.ScatterChart(document.getElementById('chart_throughput1'));

    dataThroughput2 = new google.visualization.DataTable();
    dataThroughput2 .addColumn('date', 'Time');
    dataThroughput2 .addColumn('number', 'Segment Download Time');
    chartThroughput2 = new google.visualization.ScatterChart(document.getElementById('chart_throughput2'));

    dataSegmentSize = new google.visualization.DataTable();
    dataSegmentSize .addColumn('number', 'Segment Size');
    chartSegmentSize = new google.visualization.Histogram(document.getElementById('chart_SegmentSize'));


  }
    
function clearReport(){
  let tempInfo = []
  let offset = lastSegmentDuration*Math.floor(bufferLevel/lastSegmentDuration)
  mediaFilesInfo.forEach(element => {
    if (element.mediaType == "video" && element.startTime >= lastStartTime-offset){
      tempInfo.push(element);
    }
  })
  mediaFilesInfo=tempInfo;
  MediaSegments=0 + mediaFilesInfo.length;
  log("userEvent", "Records cleaned. New start time: " + (lastStartTime-offset).toString())
}


function checkLL(){
if (document.getElementById("lowlatency").checked) {lowlatency=true}
else {lowlatency=false};
reset_playback()
}


function showEvent(e){
  if (e.type === 'manifestLoaded'){
    mpd = e.data
  }
  if (e.type==='fragmentLoadingCompleted' && e.request.mediaType === "video" && e.request.type === "MediaSegment") {
    lastSegmentDuration = e.request.duration;
    lastStartTime = e.request.startTime
    if (e.request.bytesTotal){
      videoBitrate= (e.request.bytesTotal*8/1000) / e.request.duration
    }
    //console.log(e)
    log( e.type, e.request.url);
    downloadTime = e.request.requestEndDate.getTime()- e.request.requestStartDate.getTime();
    bytesTotal= e.request.bytesTotal
    mediaFilesInfo.push({index: e.request.index,
                        startTime: e.request.startTime,
                        timescale: e.request.timescale,
                        duration: e.request.duration,
                        mediaType: e.request.mediaType, 
                        downloadingTime:e.request.requestEndDate.getTime()- e.request.requestStartDate.getTime(),
                        type: e.request.type,
                        bytesTotal: e.request.bytesTotal,
                        quality :  e.request.quality,
                        representationId: e.request.representationId,
                        url : e.request.url,
                        serviceLocation : e.request.serviceLocation })
    //console.log(mediaFilesInfo[mediaFilesInfo.length-1])
    ++MediaSegments
    plotBitrate();
    updatePlaybackLogs();
    }
    }



function log(key, msg) {
  msg = msg.length > 60 ?   "..." + msg.substring(msg.length -60, msg.length): msg; // to avoid wrapping with large objects
  msg = key + ":" + msg;
  var tracePanel = document.getElementById("trace");
  tracePanel.innerHTML += msg + "\n";
  tracePanel.scrollTop = tracePanel.scrollHeight;
  //console.log(msg);
  }


function downloadReport(){
  let MediaInfo = player.getTracksFor("video")[0];
  let MediaFiles =  mediaFilesInfo;
  let mpdSummary = mpdParser();

  let jsonContent =  JSON.stringify({mpdSummary, MediaInfo, MediaFiles})

  jsonContent = [jsonContent];
  var blob1 = new Blob(jsonContent, { type: "text/plain;charset=utf-8" });
  //Check the Browser.
  var isIE = false || !!document.documentMode;
  if (isIE) {
        window.navigator.msSaveBlob(blob1, "MediaFilesInfo.json");
    } 
  else{
  let url = window.URL || window.webkitURL;
  link = url.createObjectURL(blob1);
  let a = document.createElement("a");
  a.download = "MediaFilesInfo.json";
  a.href = link;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  log("userEvent", "Logs Downloaded")
  }
}

const postJson = async (jsonContent) => {
  const response = await fetch(server, {
    method: 'POST',
    body: jsonContent, // string or object
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const resp = await response;
  console.log (resp)
}

function downloadSegments(){
  let MediaInfo = player.getTracksFor("video")[0];
  let MediaFiles =  mediaFilesInfo;
  let mpdSummary = mpdParser();
  let jsonContent =  JSON.stringify({mpdSummary, MediaInfo, MediaFiles});
  postJson(jsonContent)

}

function setServer(){
  server = document.getElementById('server').value;
}

function mpdParser(){
  let mpdSummary={};
  mpdSummary['baseUrl'] = mpd.baseUri;
  mpdSummary['mpdUrl'] = player.getSource()
  if (typeof  mpd.Period.BaseURL  === "undefined" ) mpdSummary['periodUrl'] = "";
  else mpdSummary['periodUrl'] = mpd.Period.BaseURL;
  
  mpdSummary['videoRepresentations'] = {}
  let videoRepresentation = dashAdapter.getAdaptationForType(streamInfo.index, "video",streamInfo );
  for (const representation of videoRepresentation.Representation_asArray ) {
    mpdSummary['videoRepresentations'][representation.id] = { initialization: representation.SegmentTemplate.initialization,
                                                  media: representation.SegmentTemplate.media,
                                                  timescale: representation.SegmentTemplate.timescale
                                                }
  }
  return mpdSummary;
}
