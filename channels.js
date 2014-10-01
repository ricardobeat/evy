;(function(global){

    var EventEmitter

    if (typeof require !== 'undefined') {
        EventEmitter = require('./events')
    } else {
        EventEmitter = global.Emmy || global.EventEmitter
    }

    // Channels API
    // ------------------------------------------------------------------------
   
    var api = {
        _channels: {}
    }

    // Get channel
    api.channel = function (name) {
        if (!this._channels.hasOwnProperty(name)) {
            throw new Error('Channel ' + name + ' does not exist.')
        }
        return this._channels[name]
    }

    // Create new channel
    api.createChannel = function (name, options) {
        if (typeof name !== 'string') {
            options = name
            name = options.name
        }

        if (this._channels.hasOwnProperty(name)) {
            throw new Error('Channel ' + name + ' has already been defined.')
        }

        options = options || {}
        options.strict = true
        options.name   = name

        var channel = new EventEmitter(options)
        return this._channels[name] = channel
    }

    // Export commonJS / global / AMD
    // ------------------------------------------------------------------------
    
    if (typeof exports !== 'undefined' && module.exports) {
        module.exports = api
    } else if (typeof define !== 'undefined') {
        define('eventChannel', function () { return api })
    } else {
        this.eventChannel = api
    }

}).call(this, this)
