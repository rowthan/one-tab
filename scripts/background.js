var callback = function(details) {
    var headers = details.responseHeaders;
    for (var i = 0; i < headers.length; ++i) {
        // 移除X-Frame-Options字段
        if (headers[i].name.toLowerCase() === 'x-frame-options') {
            headers.splice(i, 1);
            break;
        }
    }
    // 返回修改后的headers列表
    return { responseHeaders: headers };
};
// 监听哪些内容
var filter = {
    urls: ["<all_urls>"]
};
// 额外的信息规范，可选的
var extraInfoSpec = ["blocking", "responseHeaders"];
/* 监听response headers接收事件*/
chrome.webRequest.onHeadersReceived.addListener(callback, filter, extraInfoSpec);


chrome.extension.onRequest.addListener(function (request,sender,sendResponse) {
    switch (request.type) {
        case 'setBadge':
            const badge = request.number ? request.number+'' : ''
            chrome.browserAction.setBadgeText({text:badge,tabId:sender.tab.id})
            chrome.browserAction.setTitle({title:badge?'已合拢'+badge+"个网页":'',tabId:sender.tab.id})
            break;
    }
})

chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab) {
    const valid = tab.url.indexOf('http') > -1;
    if(!valid){
        chrome.browserAction.setIcon({
            path:'images/icon-16-disable.png',
            tabId:tab.id
        })
    }else{
        chrome.browserAction.setIcon({
            path:'images/icon-16.png',
            tabId:tab.id
        })
    }
});
