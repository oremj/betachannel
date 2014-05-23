/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AWS = require('aws-sdk');

var appBase = require('../app_base');
var User = require('./user').User;
var loadByVersion = require('./version').loadByVersion;

var VERSIONS = require('../../lib/db_aws').VERSIONS;
var VERSIONS_BY_APP_NAME = require('../../lib/db_aws').VERSIONS_BY_APP_NAME;
var VERSIONS_BY_EMAIL = require('../../lib/db_aws').VERSIONS_BY_EMAIL;

/**
 * TODO: Currently we just have one table Version
 * it would speed things up to have an App table, too
 * And then this code would stop querying version
 */

exports.App = function(user, manifest) {
  this.name = manifest.name;
  this.user = user;
  this.code = this.appId(user, manifest);
};

exports.App.prototype.appId = appBase.appId;

exports.findApp = function(user, manifest, cb) {
  cb(null, new exports.App(user, manifest));
};

exports.findOrCreateApp = function(user, manifest, cb) {
  exports.findApp(user, manifest, function(err, anApp) {
    if (err) return cb(err);
    if (null === anApp) {
      cb(null, new exports.App(user, manifest));
    } else {
      cb(null, anApp);
    }
  });
};

// Assumes at least one version exists
exports.loadByCode = function(email, code, cb) {
  var dynamoDB = new AWS.DynamoDB();
  var params = {
    TableName: VERSIONS,
    IndexName: VERSIONS_BY_APP_NAME,
    AttributesToGet: ['versionId', 'appId', 'manifest', 'createdAt'],
    Select: 'SPECIFIC_ATTRIBUTES',
    KeyConditions: {
      appId: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{
          S: code
        }]
      }
    }
  };
  dynamoDB.query(params, function(err, data) {
    if (err) return cb(err);
    if (data.Count > 0) {
      var aUser = new User(email);
      try {
        var anApp = new exports.App(aUser, JSON.parse(data.Items[0].manifest.S));
      } catch (e) {
        return cb(e);
      }
      cb(err, anApp);
    } else {
      cb(err, null);
    }
  });
};

// Assumes at least one version exists
exports.appList = function(email, cb) {
  var dynamoDB = new AWS.DynamoDB();
  var params = {
    TableName: VERSIONS,
    IndexName: VERSIONS_BY_EMAIL,
    AttributesToGet: ['versionId', 'appId'],
    Select: 'SPECIFIC_ATTRIBUTES',
    KeyConditions: {
      createdBy: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{
          S: email
        }]
      }
    }
  };
  dynamoDB.query(params, function(err, data) {
    if (err) return cb(err);
    if (data.Count > 0) {
      var appList = [];
      for (var i = 0; i < data.Count; i++) {
        var appId = data.Items[i].appId.S;
        if (appList.indexOf(appId) === -1) {
          appList.push(appId);
        }
      }
      return cb(err, appList);
    } else {
      cb(err, []);
    }
  });
};