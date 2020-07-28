
// player
let video, player, controlbar, dashMetrics, streamInfo,src, firstSegment=true, init_time;

//Google charts
let data_profiles, data_bitrate, lowlatency= false;

// video metrics
let mediaFilesInfo=[], MediaSegments=0, interval;
let lastDecodedByteCount=0,bufferLevel, lastSegmentDuration, lastStartTime, videoBitrate=0, bitrate=0;

function init() {
  //initializing the player
  player = dashjs.MediaPlayer().create();
  player.updateSettings({ 'streaming': { 'lowLatencyEnabled': false }});
  player.updateSettings({'debug': {'logLevel': dashjs.Debug.LOG_LEVEL_NONE }});
  player.initialize();

  //initializing the view
  video = document.querySelector(".videoContainer video");
  player.attachView(video)
  url = document.getElementById('srcUrl').value;
  player.attachSource(url);

  controlbar = new ControlBar(player);
  controlbar.initialize();

  //initializing trace textbox
  document.getElementById("trace").innerHTML = ""; 
  //initializing chart

  google.charts.load('current', {'packages':['corechart', 'line']});
  google.charts.setOnLoadCallback(initializeChart);

  //poller for metrics
  interval = 2;

  let eventPoller = setInterval(update_metrics,interval*1000);

  // event handler
  player.on(dashjs.MediaPlayer.events['FRAGMENT_LOADING_COMPLETED'],showEvent);


}
          
function reset_playback() {
    mediaFilesInfo=[]
    MediaSegments=0
    lastDecodedByteCount=0
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


function update_metrics(){
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

function plot_bitrate(){
  if (!isNaN(lastStartTime) && !isNaN(videoBitrate) && !isNaN(bitrate)){
    if (firstSegment===true) {
      init_time = lastStartTime;
      firstSegment=false;
    };

    if (data_bitrate!=undefined){
      data_bitrate.addRow([lastStartTime-init_time, Math.round(videoBitrate), bitrate]);
      if (data_bitrate.getNumberOfRows() > 500){ data_bitrate.removeRow(0); }
      chart_bitrate.draw(data_bitrate, {
        title: 'Bitrate',
        hAxis: {title: 'TimeStamp Video'},
        vAxis: {title: 'Kbps'},
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });
    }
  }
  
}

function update_playback_info(){
  if (dashMetrics!=null  && streamInfo!=null ){
    const periodIdx = streamInfo.index;
    var repSwitch = dashMetrics.getCurrentRepresentationSwitch('video', true);
    bitrate = repSwitch ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000) : NaN;   
    var adaptation = dashAdapter.getAdaptationForType(periodIdx, 'video', streamInfo)
    var frameRate = adaptation.Representation_asArray.find(function (rep) {
      return rep.id === repSwitch.to
    }).frameRate;

    document.getElementById('framerate').innerText = frameRate + " fps";

    let q_index = player.getQualityFor('video')
    let q_details = player.getBitrateInfoListFor("video")[q_index]
    document.getElementById('lastSegmentDuration').innerText = lastSegmentDuration;
    document.getElementById('lastStartTime').innerText = lastStartTime;
    document.getElementById('currentQuality').innerText = '[id: '+repSwitch.to+'][index: ' + q_index + ']';
    document.getElementById('MediaSegments').innerText = '['+MediaSegments+']';


    if (typeof q_details !== 'undefined') {
      document.getElementById('currentBitrate').innerText = bitrate + ' kbps @ ' + q_details.width + 'x' + q_details.height ; }
    if (!video.paused && bufferLevel){
      var color = "#0070cc";
      data_profiles.addRow([new Date(), q_index, 'Buffer = ' + bufferLevel + 's','point {fill-color: ' + color + '}']);
      if (data_profiles.getNumberOfRows() > 500){
        data_profiles.removeRow(0); }
      chart_profiles.draw(data_profiles, {
        title: 'Quality Index',
        hAxis: {title: 'Local Time'},
        vAxis: {title: 'Index'},
        legend: 'none',
        explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
      });
    } 
  }
}

function initializeChart() {
    data_profiles = new google.visualization.DataTable();
    data_profiles .addColumn('date', 'Time');
    data_profiles .addColumn('number', 'Quality Index');
    data_profiles .addColumn({'type':'string', 'role':'tooltip'}); 
    data_profiles .addColumn({'type': 'string', 'role': 'style'});
    chart_profiles = new google.visualization.LineChart(document.getElementById('chart_profiles'));
    
    data_bitrate = new google.visualization.DataTable();
    data_bitrate .addColumn('number', 'timestamp');
    data_bitrate .addColumn('number', 'video bitrate');
    data_bitrate .addColumn('number', 'profile bitrate');
    chart_bitrate = new google.charts.Line(document.getElementById('chart_bitrate'));
    google.visualization.events.addListener(chart_bitrate, 'error', function (err) {
      google.visualization.errors.removeError(err.id);
    });
  }
    
function clearReport(){
  let tempInfo = []
  let offset = lastSegmentDuration*Math.ceil(bufferLevel/lastSegmentDuration)
  mediaFilesInfo.forEach(element => {
    if (element.type === "InitializationSegment" ) {tempInfo.push(element);}
    if (element.type === "video" && element.startTime >= lastStartTime-offset){
      tempInfo.push(element);
    }
  })
  mediaFilesInfo=tempInfo;
  MediaSegments=0;
  log("userEvent", "Records cleaned. New start time: " + (lastStartTime-offset).toString())
}


function checkLL(){
if (document.getElementById("lowlatency").checked) {lowlatency=true}
else {lowlatency=false};
reset_playback()
}


function showEvent(e){
      if (e.request.mediaType === "video") {
        lastSegmentDuration = e.request.duration;
        lastStartTime = e.request.startTime
        if (e.request.bytesTotal){
          videoBitrate= (e.request.bytesTotal*8/1000) / e.request.duration
        }
        console.log(e)
        log( e.type, e.request.url);
        mediaFilesInfo.push({index: e.request.index,
                            startTime: e.request.startTime,
                            duration: e.request.duration,
                            mediaType: e.request.mediaType, 
                            type: e.request.type,
                            bytesTotal: e.request.bytesTotal,
                            quality :  e.request.quality,
                            representationId: e.request.representationId,
                            url : e.request.url,
                            serviceLocation : e.request.serviceLocation })
        console.log(mediaFilesInfo[mediaFilesInfo.length-1])
        }
      if (e.request.type === "MediaSegment"){ ++MediaSegments }
      plot_bitrate()
      update_playback_info();
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
  let MediaInfo = player.getTracksFor("video")[0]
  let MpdUrl = player.getSource()
  let MediaFiles =  mediaFilesInfo
  let Representations = []

  for (let i =0; i < MediaInfo.representationCount; i++){
    player.setQualityFor("video",i)
    Representations.push(dashMetrics.getCurrentRepresentationSwitch("video").to)
  }


  let jsonContent =  JSON.stringify({MpdUrl, MediaInfo, MediaFiles, Representations})

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
