var KintoneManager = (function() {
  "use strict";
  /**
   * user, passが指定されれば、パスワード認証
   * 指定されなければ、APIトークン認証
   * appsは以下の形式
   * {
   *    // アプリケーション名はkintoneのデータに依存せず、GAS内のコードで取り扱う専用
   *    YOUR_APP_NAME1: {
   *    appid: 1,
   *       guestid: 2,
   *       name: "日報",
   *       token: "XXXXXXXXXXXXXX_YOUR_TOKEN_XXXXXXXXXXXXXX" // パスワード認証する場合は省略化
   *    },
   *    YOUR_APP_NAME2: {
   *       ...
   *    }
   * }
   *
   * @param {string} subdomain your subdomain (For kintone.com domains, you must state the FQDN such as "subdomain.kintone.com" )
   * @param {object} apps application information.
   * @param {string} user (optional) user name or encoded authentication information: base64("USER:PASS")
   * @param {string} pass (optional) password
   * @constructor
   */
  function KintoneManager(subdomain, apps, user, pass) {
    this.subdomain = subdomain;
    this.authorization = null;
    this.apps = apps;

    if (arguments.length > 3) {
      this.authorization = Utilities.base64Encode(user + ":" + pass);
    } else if (arguments.length > 2) {
      // 引数が3つの場合はエンコード済みの認証情報として処理
      this.authorization = user;
    }
  }
  /**
   * Constructor
   * @param {string} app_name Application name
   * @param {Array} records Kintone record objects ref) https://developer.cybozu.io/hc/ja/articles/201941784
   * @returns {HTTPResponse} ref) https://developers.google.com/apps-script/reference/url-fetch/http-response
   */
  KintoneManager.prototype.create = function(app_name, records) {
    var app = this.apps[app_name];
    var payload = {
      app: app.appid,
      records: records
    };
    var response = UrlFetchApp.fetch(
      "@1/records.json".replace(/@1/g, this._getEndpoint(app.guestid)),
      this._postOption(app, payload)
    );
    return response;
  };
  /**
   * Search records
   * @param {string} app_name Application name
   * @param {string} query kintone API query ref) https://developer.cybozu.io/hc/ja/articles/202331474-%E3%83%AC%E3%82%B3%E3%83%BC%E3%83%89%E3%81%AE%E5%8F%96%E5%BE%97-GET-#step2
   * @returns {Array} search results
   */
  KintoneManager.prototype.search = function(app_name, query) {
    var q = encodeURIComponent(query);
    var app = this.apps[app_name];
    var response = UrlFetchApp.fetch(
      "@1/records.json?app=@2&query=@3&totalCount=true"
        .replace(/@1/g, this._getEndpoint(app.guestid))
        .replace(/@2/g, app.appid)
        .replace(/@3/g, q),
      this._getOption(app)
    );
    return response;
  };
  /**
   * Updates records
   * @param {string} app_name Application name
   * @param {Array} records Array of records that will be updated.
   * @returns {HTTPResponse} ref) https://developers.google.com/apps-script/reference/url-fetch/http-response
   */
  KintoneManager.prototype.update = function(app_name, records) {
    var app = this.apps[app_name];
    var payload = {
      app: app.appid,
      records: records
    };
    var response = UrlFetchApp.fetch(
      "@1/records.json".replace(/@1/g, this._getEndpoint(app.guestid)),
      this._putOption(app, payload)
    );
    return response;
  };
  /**
   * Deletes Records
   * @param {string} app_name Application name
   * @param {Array} record_ids Array of record IDs that will be deleted.
   * @returns {HTTPResponse} ref) https://developers.google.com/apps-script/reference/url-fetch/http-response
   */
  KintoneManager.prototype.destroy = function(app_name, record_ids) {
    var app = this.apps[app_name];
    var query = "app=" + app.appid;
    for (var i = 0; i < record_ids.length; i++) {
      query += "&ids[@1]=@2".replace(/@1/g, i).replace(/@2/g, record_ids[i]);
    }
    var response = UrlFetchApp.fetch(
      "@1/records.json?@2"
        .replace(/@1/g, this._getEndpoint(app.guestid))
        .replace(/@2/g, query),
      this._deleteOption(app)
    );
    return response;
  };
  /**
   * option for GET Method
   * @param {object} app Application object
   * @returns {object} Option for UrlFetchApp
   * @private
   */
  KintoneManager.prototype._getOption = function(app) {
    var option = {
      method: "get",
      headers: this._authorizationHeader(app),
      muteHttpExceptions: true
    };
    return option;
  };
  /**
   * option for POST Method
   * @param {object} app Application object
   * @param {object} payload Request payload
   * @returns {object} Option for UrlFetchApp
   * @private
   */
  KintoneManager.prototype._postOption = function(app, payload) {
    var option = {
      method: "post",
      contentType: "application/json",
      headers: this._authorizationHeader(app),
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    };
    return option;
  };
  /**
   * option for PUT Method
   * @param {object} app Application object
   * @param {object} payload Request payload
   * @returns {object} Option for UrlFetchApp
   * @private
   */
  KintoneManager.prototype._putOption = function(app, payload) {
    var option = {
      method: "put",
      contentType: "application/json",
      headers: this._authorizationHeader(app),
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    };
    return option;
  };
  /**
   * option for DELETE Method
   * @param {object} app Application Object
   * @returns {object} option Option for UrlFetchApp
   * @private
   */
  KintoneManager.prototype._deleteOption = function(app) {
    var option = {
      method: "delete",
      headers: this._authorizationHeader(app),
      muteHttpExceptions: true
    };
    return option;
  };
  /**
   * Gets Endpoint
   * @param {string} guest_id (optional) Guest id if you are a guest account.
   * @returns {string} Endpoint url
   * @private
   */
  KintoneManager.prototype._getEndpoint = function(guest_id) {
    if(this.subdomain.slice(-4) == '.com') {
      var endpoint = "https://@1".replace(/@1/g, this.subdomain);
    } else {
      var endpoint = "https://@1.cybozu.com".replace(/@1/g, this.subdomain);
    }
    if (guest_id == null) {
      return endpoint + "/k/v1";
    } else {
      return endpoint + "/k/guest/@1/v1".replace(/@1/g, guest_id);
    }
  };
  /**
   * Header Authentication Information
   * @param {object} app Application object
   * @param {string} app.token Application's API token
   * @returns {object}
   * @private
   */
  KintoneManager.prototype._authorizationHeader = function(app) {
    if (this.authorization) {
      // Password authentication
      return { "X-Cybozu-Authorization": this.authorization };
    } else if (app.token) {
      // API token authentication
      return { "X-Cybozu-API-Token": app.token };
    } else {
      throw new Error("Authentication Failed");
    }
  };
  return KintoneManager;
})();
