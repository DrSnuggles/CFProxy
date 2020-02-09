/*
Advanced proxy by DrSnuggles using a cloudflare worker
Vectrexer had the nice idea to also load ZIP/RAR/7Z content
I was first thinking of doing that client side
but since Vectrexer requested this feature for URLs i will do here
and deliver depacked content to vecx

Test:
Oregon Trail: https://docs.google.com/uc?export=download&id=1zBvCN6Ap9723LGDcXNonXFppOsaW2Mu4
MineStorm.ZIP: https://docs.google.com/uc?export=download&id=1WcrVSDBkcIsfVZFnMRdJFxXMLdNTzW1r
*/

//
// Vars
//
var debug = false
var maxSize = 256 * 1024 // 256kB
var req // request
var src // requesting source
var dst // final destination
var Zip = require('uzip')

//
// Listener
//
addEventListener('fetch', event => {
  if (debug) console.clear()
  req = event.request
  event.respondWith( handleRequest() )
})

//
// Answerer
//
async function handleRequest() {
  if (debug) console.log("handleRequest", req)

  src = req.headers.get("Origin")
  src = (typeof src !== "string") ? "" : src
  src = src.toLowerCase()

  // Make the headers mutable by re-constructing the Request.
  req = new Request( req )
  req.headers.set('Access-Control-Allow-Origin', '*')
  req.headers.set('Redirect', 'Follow')

  dst = new URL(req.url)
  dst = unescape( unescape( dst.search.substr(1) ) )
  if (dst.length === 0) return nope(src) // no dst set

  // filter... the overlay <img src="..." has null
  if (debug || src.indexOf("https://drsnuggles.github.io") === 0 || src.indexOf("https://mstest.net") === 0) {

    return recFetch()
    .then(res => {
      if (debug) console.log(res)
      //return new Response(res)
      return decrunchTry(res)
      .then(res => {
        if (debug) console.log("after dec: ", res)
        if (res) {
          return res
        } else {
          return nope()
        }

      })
    })
    .catch(e => {
      console.error("recFetch catch:", e)
    })

  } else {
    // not allowed
    return nope()
  }
}

//
// recursive Fetch
//
async function recFetch() {
  if (debug) console.log("recFetch", dst, req)
  return fetch(dst, req)
  .then(res => {
    if (debug) console.log("got status:", res.status, res.statusText)
    // error handling
    switch (res.status) {
      case 301: // perm. moved => follow
      case 302: // temp. moved => follow
        dst = res.headers.get("location")
        //if (debug) console.log(dst)
        return recFetch()
        .then(res => {
          //if (debug) console.log(res)
          return res
        }).catch(e =>{
          console.error(e)
        })
        break
      case 200:
        if (debug) console.log("200", res)
        return res
        break;
      default:
        console.error("found unhandled status: ", res)
        //return false
        //return new Response(res) // new sets status 200
        return res
        break
    }
  })
  .catch(e => {
    console.error(e)
  })
}

//
// negative Response
//
async function nope(){
  if (debug) {
    console.log("nope")
    return new Response("The use of this proxy is restricted",{status: 403, statusText: 'Forbidden', headers: {"Content-Type": "text/html", "src": src, "dst": dst}})
  } else {
    return new Response("The use of this proxy is restricted",{status: 403, statusText: 'Forbidden', headers: {"Content-Type": "text/html"}})
  }
}

//
// decrunch Try
//
async function decrunchTry(res){
  if (debug) console.log("decrunchTry")
  if (!res) return nope()
  if (debug) console.log("decrunchTry2")
  var zipped = false

  // use reader
  var reader = res.body.getReader()
  var chunk = await reader.read() // we are not really sure if it's compressed or not

  // quick req if zipped or not. first two chars = PK
  if (chunk.value[0] === 80 && chunk.value[1] === 75) {
    if (debug) console.log("PK header found in:", chunk)
    zipped = true
  }

  //
  // Pump all chunks because we already started reading
  //
  var arr = [];
  while (!chunk.done) {
    for (let i = 0; i < chunk.value.length; i++) {
      arr.push(chunk.value[i]);
    }

    // filter
    if (arr.length > maxSize) {
      if (debug) console.log("File to large than: ", maxSize)
      return nope(src,dst) // file to large
    }

    chunk = await reader.read()
  }
  reader.releaseLock();
  if (debug) console.log("read complete", arr)
  var buf = new Uint8Array(arr).buffer;

  // identify known formats
  //if (debug) console.log(arr)
  if (!zipped) {

    // skip here and re read
    var res = await fetch(dst, req)
    var meta = {"status": 200, "statusText": "OK", headers: {"Access-Control-Allow-Origin": "*"} }
    res = new Response(res.body, meta)
    return res

    /* did not work very well
    var td = new TextDecoder()
    var stream = td.decode(buf) // now without await, we waited long enough....
    var meta = {"status": 200, "statusText": "OK", headers: {"Access-Control-Allow-Origin": "*"} }
    var res = new Response(stream, meta)
    return res
    */
  }

  // depack / inflate / decrunch / unzip
  if (debug) console.log("OK we send it to unzip")
  var zip = Zip.parse(buf)
  var firstFile = Object.keys(zip)[0]
  /* could search for .bin .rom .vec files
  for (let i in zip) {
    console.log(i, zip[i])
  }
  */
  var data = zip[firstFile]
  if (data.length > maxSize) return nope(src, dst)

  var meta = {"status": 200, "statusText": "OK", headers: {"Access-Control-Allow-Origin": "*"} }
  return new Response(data, meta)

}
