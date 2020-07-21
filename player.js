var video, player, options, data, src, 
    options, controlbar, dashMetrics, 
    mediaFilesInfo=[], firstLoad = true;

    function setPlayerEvents() {
        player.on(dashjs.MediaPlayer.events['FRAGMENT_LOADING_COMPLETED'],showEvent);
    }


    function setPlayerSettings() {
        player.updateSettings({ 'streaming': { 'lowLatencyEnabled': false }});
        player.updateSettings({'debug': {'logLevel': dashjs.Debug.LOG_LEVEL_DEBUG }});
        //player.updateSettings({ 'debug': { 'logLevel': dashjs.Debug.LOG_LEVEL_NONE }});
    }


    function init() {
        //initializing the player
        player = dashjs.MediaPlayer().create();
        setPlayerSettings();
        setPlayerEvents();
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
    }
          
    function start(button) {
        mediaFilesInfo=[]
        controlbar.reset();
        url = document.getElementById('srcUrl').value;
        player.attachSource(url);
        button.value = "Reload"
        log("userEvent", "Video loaded")
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(initializeChart);
        var eventPoller = setInterval(update,800);
    }

    function update(){
      dashMetrics = player.getDashMetrics();
      if (dashMetrics) {
        var bufferLevel = dashMetrics.getCurrentBufferLevel('video');
        var bitrate_index = player.getQualityFor('video')
        var bitrate_details = player.getBitrateInfoListFor("video")[bitrate_index]
        document.getElementById('bufferLevel').innerText = bufferLevel + " secs";
        document.getElementById('currentQuality').innerText = '['+bitrate_index+']';
        if (typeof bitrate_details !== 'undefined') {
          document.getElementById('currentBitrate').innerText = bitrate_details.bitrate/1000 + ' kbps @ ' + bitrate_details.width + 'x' + bitrate_details.height ; }
        if (!video.paused){
          var color = "#0070cc";
          data.addRow([new Date(), bitrate_index, 'Buffer = ' + bufferLevel + 's','point {fill-color: ' + color + '}']);
          if (data.getNumberOfRows() > 500){
            data.removeRow(0); }
          chart.draw(data, options);
        }  
      }
    }


    function initializeChart() {
        options = {
          title: 'Quality Index',
          hAxis: {title: 'Local Time'},
          vAxis: {title: 'Index'},
          legend: 'none',
          explorer: { actions: ['dragToZoom', 'rightClickToReset'], maxZoomIn: 0 }
          };
        data = new google.visualization.DataTable();
        data.addColumn('date', 'Time');
        data.addColumn('number', 'Quality Index');
        data.addColumn({'type':'string', 'role':'tooltip'}); 
        data.addColumn({'type': 'string', 'role': 'style'});
        chart = new google.visualization.LineChart(document.getElementById('chart_div'));
      }
    
    function clearReport(){
      let tempInfo = []
      mediaFilesInfo.forEach(element => {if (element.type == "InitializationSegment" ) {tempInfo.push(element);}})
      mediaFilesInfo=tempInfo;
      log("userEvent", "logs cleaned")

    }

    function showEvent(e){
	        if (e.request.mediaType === "video") {
            log( e.type, e.request.url);
            mediaFilesInfo.push({index: e.request.index,
                                startTime: e.request.startTime, 
                                mediaType: e.request.mediaType, 
                                type: e.request.type,
                                quality :  e.request.quality,
                                representationId: e.request.representationId,
                                url : e.request.url,
                                serviceLocation : e.request.serviceLocation })
            console.log(mediaFilesInfo[mediaFilesInfo.length-1])
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
      //let encodedUri = "data:text/json;charset=utf-8," + encodeURIComponent(jsonContent);
      //let link = document.createElement("a");
      //link.setAttribute("href", encodedUri);
      //link.setAttribute("download", "MediaFilesInfo.json");
      //document.body.appendChild(link);
      //link.click();
      //document.body.removeChild(link)
      //link.remove();
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
