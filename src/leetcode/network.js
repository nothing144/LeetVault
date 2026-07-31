/**
 * src/leetcode/network.js
 * Responsibilities: intercept native network requests natively (fetch/XHR), strictly observe payloads, 
 * and dispatch custom events without breaking the main execution context.
 */
(function() {
  if (window.__LeetVault_Network_Injected) return;
  window.__LeetVault_Network_Injected = true;

  // ==============================================================================
  // FETCH INTERCEPTOR (via Proxy)
  // ==============================================================================
  
  // Design Decision: We use a Proxy to encapsulate window.fetch. This perfectly preserves 
  // `.name`, `.length`, `.toString()`, and `this` binding natively.
  window.fetch = new Proxy(window.fetch, {
    apply: function(target, thisArg, argumentsList) {
      const url = argumentsList[0];
      const options = argumentsList[1] || {};

      // 1. Observe Outbound Submission Requests
      try {
        // Assumption: Submit requests are sent to /problems/<slug>/submit/
        if (typeof url === 'string' && window.LeetCodeParser && window.LeetCodeParser.SUBMIT_REGEX.test(url)) {
          if (options.body && typeof options.body === 'string') {
            const payload = window.LeetCodeParser.parseSubmitPayload(options.body);
            if (payload) {
              document.dispatchEvent(new CustomEvent('LeetVault:CodeSubmitted', { 
                detail: JSON.stringify({ code: payload.code, language: payload.language }) 
              }));
            }
          }
        }
      } catch (err) { 
        // Strict Requirement: Catch all errors internally to avoid breaking LeetCode's execution
        console.warn("LeetVault Network Interceptor (Fetch Submit) Error:", err);
      }

      // Execution: Forward the request absolutely unaltered
      const fetchPromise = Reflect.apply(target, thisArg, argumentsList);
      
      // 2. Observe Inbound Submission Results
      fetchPromise.then(response => {
        try {
          // Assumption: Status checks are polled at /submissions/detail/<id>/check/
          if (typeof url === 'string' && window.LeetCodeParser && window.LeetCodeParser.CHECK_REGEX.test(url)) {
            // Strict Requirement: MUST clone the response stream to prevent the "body already consumed" TypeError 
            // when LeetCode's frontend attempts to read it natively.
            const clonedResponse = response.clone();
            clonedResponse.text().then(bodyText => {
              const metrics = window.LeetCodeParser.isAccepted(bodyText);
              if (metrics) {
                document.dispatchEvent(new CustomEvent('LeetVault:SubmissionAccepted', { 
                  detail: JSON.stringify({ timestamp: Date.now(), ...metrics }) 
                }));
              }
            }).catch((err) => {
              console.warn("LeetVault Network Interceptor (Fetch Parse) Error:", err);
            });
          }
        } catch (err) {
           console.warn("LeetVault Network Interceptor (Fetch Check) Error:", err);
        }
      }).catch(() => {}); // Catch fetch rejections internally to not affect the main Promise chain

      // Strict Requirement: Preserve original Promise behavior natively
      return fetchPromise;
    }
  });

  // ==============================================================================
  // XMLHTTPREQUEST INTERCEPTOR (via Proxy)
  // ==============================================================================

  // Securely map native XHR instances to their requested URLs without mutating the object
  const xhrUrlMap = new WeakMap();

  // Design Decision: While LeetCode primarily uses fetch, third-party monitoring or older 
  // routing might fall back to XHR. We proxy open/send to ensure robust interception.
  XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
    apply: function(target, thisArg, argumentsList) {
      xhrUrlMap.set(thisArg, argumentsList[1]);
      return Reflect.apply(target, thisArg, argumentsList);
    }
  });

  XMLHttpRequest.prototype.send = new Proxy(XMLHttpRequest.prototype.send, {
    apply: function(target, thisArg, argumentsList) {
      const url = xhrUrlMap.get(thisArg);
      const body = argumentsList[0];
      
      // 1. Observe Outbound Submission Requests
      try {
        if (typeof url === 'string' && window.LeetCodeParser && window.LeetCodeParser.SUBMIT_REGEX.test(url)) {
          if (typeof body === 'string') {
            const payload = window.LeetCodeParser.parseSubmitPayload(body);
            if (payload) {
              document.dispatchEvent(new CustomEvent('LeetVault:CodeSubmitted', { detail: payload }));
            }
          }
        }

        // 2. Observe Inbound Submission Results
        thisArg.addEventListener('load', function() {
          try {
            if (typeof url === 'string' && window.LeetCodeParser && window.LeetCodeParser.CHECK_REGEX.test(url)) {
              const metrics = window.LeetCodeParser.isAccepted(this.responseText);
              if (metrics) {
                document.dispatchEvent(new CustomEvent('LeetVault:SubmissionAccepted', { 
                  detail: JSON.stringify({ timestamp: Date.now(), ...metrics }) 
                }));
              }
            }
          } catch (e) {
             console.warn("LeetVault Network Interceptor (XHR Check) Error:", e);
          }
        });
      } catch (err) {
         console.warn("LeetVault Network Interceptor (XHR Submit) Error:", err);
      }

      // Execution: Forward the XHR strictly unaltered
      return Reflect.apply(target, thisArg, argumentsList);
    }
  });
})();
