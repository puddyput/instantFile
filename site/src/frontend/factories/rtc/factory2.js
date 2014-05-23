var _ = require('lodash'),
    io = require('socket.io');

var RTCPeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var URL = (window.URL || window.webkitURL || window.msURL || window.oURL);
var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
var RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
var RTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription); // order is very important: "RTCSessionDescription" defined in Nighly but useless

/*
+  Event Handling
*/
var events = {};
function on(event, listener) {
  if (typeof event == 'object') {
    for (var eventName in event) on(eventName, event[eventName]);
    return;
  }

  events[event] = events[event] || [];
  events[event].push(listener);
};

function off(event, listener) {
  var listeners = events[event];
  if (listeners && listeners.length > 0) {
    for (var i = listeners.length - 1; i >= 0; i++) {
      if (listeners[i] === listener) {
        listeners.splice(i, 1);
      }
    }
    if (listeners.length == 0) delete events[event];
  }
};

function fire(event) {
  var listeners = events[event] || [],
      args = Array.prototype.slice.call(arguments, 1);

  for (var i = 0; i < listeners.length; i++) {
    listeners[i].apply(null, args);
  }
};
/*
-  Event Handling
*/

function hashList() {
  var list = [],
      hash = {};

  this.add = function(key, value) {
    list.push(value);
    hash[key] = value;
    self[list.length - 1] = value;
  };

  this.removeByKey = function(key) {
    var value = hash[key];
    _.remove(list, function(v) { return v == value; });
    delete hash[key];
  };
};

/*
+  Signalling
*/
function connectToSignal(server, onReady) {
  var socket = io.connect(server);

  function emit(event, data) { console.log('emitting', event, data); socket.emit(event, data); };

  socket.on('your_id', function(myID) {
    var peers = [],
        peersHash = {};

    signal.myID = myID;

    function createPeer(id) {
      var streams = []
          streamsHash = {},
          channels = [],
          channelsHash = {};

      var peer = {
        id: id,
        channels: channels,
        connect: function() { 
          peer.peerConnection = createConnection();
        },
        createChannel: function(label, options, handlers) {
          var channel = createChannel(id, label, options);

          attachToChannel(channel, handlers);

          return channel;
        }
      };

      function attachToChannel(channel, handlers) {
        var label = channel.label;

        function call(name, arg) {
          (handlers[name] || function () {})(arg);
        };

        channel.onopen = function() {
          call('open');
          fire('peer data_channel open', peer, label);
        };

        channel.onclose = function() {
          _.remove(channels, function(c) { return c.label === label; });
          delete channels[label];

          call('close');
          fire('peer data_channel close', peer, label);
        };

        channel.onmessage = function(message) {
          call('message', message);
          fire('peer data_channel message', peer, label, message);
        };

        channel.onerror = function(error) {
          call('error', error);
          fire('peer data_channel error', peer, label, error);
        };

        channels.push(channel);
        channelsHash[label] = channel;

        return channel;
      };

      function createConnection() {
        var connection = new RTCPeerConnection({
          iceServers: [{url: 'stun:stun.l.google.com:19302'}]
        });
        
        connection.onnegotiationneeded = function() {
          sendOffer(peer.id);
        };

        connection.onicecandidate = function(event) {
          var candidate = event.candidate;

          if (candidate) {
            emit('ice_candidate', {
              peerID: id,
              label: candidate.sdpMLineIndex,
              candidate: candidate.candidate
            });

            fire('peer ice_candidate', peer, candidate);
          }
        };

        connection.onsignalingstatechange = function(event) {
          console.log(event);
          fire('peer signaling_state_change', peer, event);
        };

        connection.onaddstream = function() {
          fire('peer add_')
        };

        connection.onremovestream = function() {

        };

        connection.oniceconnectionstatechange = function() {

        };

        connection.ondatachannel = function(event) {
          var channel = event.channel;
          
          // Override these functions when you get passed 'handlers'
          var handlers = {
            open: function() {},
            close: function() {},
            message: function(message) {console.log(message);},
            error: function(error) {}
          };

          attachToChannel(channel, handlers);

          fire('peer data_channel connected', peer, channel, handlers);
        };

        return connection;
      };


      return peer;
    };

    function getPeer(id) {
      return peersHash[id];
    };

    function addPeer(id) {
      var peer = createPeer(id);
      peers.push(peer);
      peersHash[id] = peer;
      
      fire('peer added', peer);
    };

    function removePeerByID(id) {
      var peer = getPeer(id);
      _.remove(peers, function(peer) { return peer.id === id; });
      delete peersHash[id];
      fire('peer removed', peer);
    };

    function addIceCandidate(peerID, candidate) {
      var peer = getPeer(peerID),
          connection = peer.peerConnection;

      connection.addIceCandidate(new RTCIceCandidate(candidate), function() {
        fire('peer ice_candidate', peer, candidate);
      }, function(err) {
        fire('peer error ice_candidate', peer, err, candidate);
      });
    };

    function sendOffer(peerID) {
      var peer = getPeer(peerID),
          connection = peer.peerConnection;

      connection.createOffer(function(offer) {
        connection.setLocalDescription(offer, function() {
          emit('peer offer', {
            peerID: peerID,
            offer: connection.localDescription
          });
          fire('peer send offer', peer, offer);
        }, function(err) {
          fire('peer error set_local_description', peer, err, offer);
        });
      }, function(err) {
        fire('peer error create offer', peer, err)
      })
    };

    function sendAnswer(peerID, offer) {
      var peer = getPeer(peerID),
          connection = peer.peerConnection;

      if (connection == null) {
        peer.connect();
        connection = peer.peerConnection;
      }      

console.log('offer', offer, connection);
      
      connection.setRemoteDescription(new RTCSessionDescription(offer), function() {
        connection.createAnswer(function(answer) {
          console.log('answer', answer);
          connection.setLocalDescription(answer, function() {
            emit('peer answer', {
              peerID: peerID,
              answer: answer
            });
            fire('peer send answer', peer, answer);
          }, function(err) {
            fire('peer error set_local_description', peer, err, answer);
          });
        }, function(err) {
          fire('peer error send answer', peer, err, offer);
        });
      }, function(err) {
        console.dir(err);
        fire('peer error set_remote_description', peer, err, offer);
      });
      fire('peer receive offer', peer, offer);
    };

    function receiveAnswer(peerID, answer) {
      var peer = getPeer(peerID),
          connection = peer.peerConnection;

      connection.setRemoteDescription(new RTCSessionDescription(answer));
      fire('peer receive answer', peer, answer);
    };

    function createChannel(peerID, label, options) {
      var peer = getPeer(peerID),
          connection = peer.peerConnection;

      return connection.createDataChannel(label, options);
    };

    socket.on('peer list', function(data) {
      _.each(data.peerIDs, addPeer);
    });

    socket.on('peer join', function(id) {
      addPeer(id);
    });

    socket.on('peer leave', function(id) {
      removePeerByID(id);
    });

    socket.on('peer ice_candidate', function(data) {
      addIceCandidate(data.peerID, data);
    });

    socket.on('peer offer', function(data) {
      sendAnswer(data.peerID, data.offer);
    });

    socket.on('peer answer', function(data) {
      receiveAnswer(data.peerID, data.answer);
    });

    fire('ready', myID);
  });

  socket.on('close', function() {

  });

  function joinRoom(roomName) {
    emit('room join', roomName);
  };

  function leaveRoom(roomName) {
    emit('room leave', roomName);
  };

  var signal = {
    on: on,
    off: off,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom
  };

  return signal;
};
/*
-  Signalling
*/

module.exports = function() {
  var signal;

  return {
    connectToSignal: function(server) {
      if (signal == null) signal = connectToSignal(server);
      return signal;
    }
  };
};