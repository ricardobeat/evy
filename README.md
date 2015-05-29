
evy.js
======

Evy is a flexible events library that draws inspiration from the [nodejs Event Emitter](https://github.com/joyent/node/blob/master/lib/events.js), [Backbone Events](http://backbonejs.org/docs/backbone.html#section-17) and [postal.js](https://github.com/postaljs/postal.js/).

It is designed to be used as a base library to build event-based abstractions on top of, like [pub-sub](http://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) or extending other object classes / prototypes.

**What makes it different from your standard event-emitter?**

- listenTo API for centralized management of external event handlers
- `strict` mode where every event has to be declared on initialization (self-documenting)
- built-in debugging / stats
- async mode (to be detailed)
- channels (TBD)
- stateful events (TBD)

## API

You can see all available methods in the [annotated source](http://cdn.rawgit.com/ricardobeat/evy/master/docs/evy.html).

## Tests

```
npm test
```

![](http://i.imgur.com/ObL3jiu.jpg)

## Benchmarks

Evy is about *10x faster* than plain Backbone.Events, and on the same level of performance as node's EventEmitter (X million events/second on a standard laptop).

```
npm run benchmark
```

