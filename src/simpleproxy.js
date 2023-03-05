/*
Simple Proxy by DrSnuggles using a cloudflare worker
*/

//
// vars
//
var debug = true

//
// listener
//
addEventListener('fetch', event => {
  if (debug) console.clear()
  event.respondWith( handleRequest(event.request) )
})

//
// answerer
//
async function handleRequest(req) {
  var src = req.headers.get("Origin")
  src = (typeof src !== "string") ? "" : src
  src = src.toLowerCase()


  // Make the headers mutable by re-constructing the Request.
  req = new Request( req )
  req.headers.set('Access-Control-Allow-Origin', '*') // not really needed
  req.headers.set("Redirect", "Follow")

  var dst = new URL(req.url)
  dst = unescape( unescape( dst.search.substr(1) ) )
  if (dst.length < 3) return nope()

  // filter... the overlay <img src="..." has null
  if (debug || src.indexOf("https://drsnuggles.github.io") === 0 || src.indexOf("https://mstest.net") === 0) {
    // allowed
    console.log(dst)
    var res = await fetch(dst, req)

    // error handling
    switch (res.status) {
      case 301: // temp. moved => follow
      case 302: // temp. moved => follow
        if (debug) console.log("manual follow 301/302")
        var tst = res.headers.get("location")
        // take care of relative URLs
        if (tst.indexOf("http") === 0) {
          dst = tst
        } else {
          dst = dst.substr(0, dst.lastIndexOf("/")) + tst
        }
        res = await fetch(dst, req)
        break
      /* that didn't solve the problem
      case 502: // thats TLS errors and more
        console.log('try again with', req.url.split("?")[1])
        res = await fetch(req.url.split("?")[1], req)
        break;
      */
      default:
        break
    }

    // Make the headers mutable by re-constructing the Response.
    var meta = {"status": 200, "statusText": "OK", headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": res.headers.get("Content-Type"),
      } }
    res = new Response(res.body, meta)
    return res
  } else {
    // not allowed
    return nope()
  }
}

async function nope(){
  return new Response("The use of this proxy is restricted",{status: 403, statusText: 'Forbidden', headers: {"Content-Type": "text/html"}})
}
