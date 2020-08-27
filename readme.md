# tglib-worker

> [`tglib`](https://github.com/nodegin/tglib) wrapped in [`tiny-worker`](https://github.com/avoidwork/tiny-worker)

[![Build Status](https://travis-ci.org/futpib/tglib-worker.svg?branch=master)](https://travis-ci.org/futpib/tglib-worker) [![Coverage Status](https://coveralls.io/repos/github/futpib/tglib-worker/badge.svg?branch=master)](https://coveralls.io/github/futpib/tglib-worker?branch=master)

## Motivation

This allows you to create and use multiple clients from one script (you can't do that with raw `tglib`).

## Usage

Use this exactly as you would use [`tglib`](https://github.com/nodegin/tglib). Worker process is created behind the scenes.

## Install

```
yarn add tglib tglib-worker
```
