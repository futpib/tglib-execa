# tglib-execa

> [`tglib`](https://github.com/nodegin/tglib) wrapped in [`execa`](https://github.com/sindresorhus/execa)

[![Build Status](https://travis-ci.org/futpib/tglib-execa.svg?branch=master)](https://travis-ci.org/futpib/tglib-execa) [![Coverage Status](https://coveralls.io/repos/github/futpib/tglib-execa/badge.svg?branch=master)](https://coveralls.io/github/futpib/tglib-execa?branch=master)

## Motivation

This allows you to create and use multiple clients from one script (you can't do that with raw `tglib`).

## Usage

Use this exactly as you would use [`tglib`](https://github.com/nodegin/tglib). Worker process is created behind the scenes.

## Install

```
yarn add tglib tglib-execa
```
