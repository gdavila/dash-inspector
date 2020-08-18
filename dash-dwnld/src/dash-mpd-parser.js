
let parser = dashjs.DashParser().create()



const getManifest = (url, cb) => {
  const req = new XMLHttpRequest()
  req.open('GET', url, false)
  req.responseType = 'application/mpd+xml'
  req.onreadystatechange = (evt) => {
    if (evt.target.readyState === 4) {
      cb(evt.target.response)
    }
  }
  req.send()
}

const parseMpd = xml =>
  parser.parse(xml, '', XLinkController().create({}))

const fetchMpd = (url, cb) =>
  getManifest(url, data => cb(parseMpd(data)))