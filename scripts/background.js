var callback = function(details) {
    var headers = details.responseHeaders;
    for (var i = 0; i < headers.length; ++i) {
        // 移除X-Frame-Options字段
        if (['x-frame-options','content-security-policy'].indexOf(headers[i].name.toLowerCase())>-1) {
            headers.splice(i, 1);
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
      case 'autoSort':
        // 平铺模式 TODO 增加多种铺放模式
        chrome.tabs.getSelected(null, function(tab) {
          chrome.windows.getAll({populate:true}, function(result){
            const currentId = tab.windowId;
            const screenWidth = window.screen.width
            const screenHeight = window.screen.height
            const windows = result.sort(function(window){
              return window.id===currentId?1:-1
            })
            windows.forEach((item,index)=>{
              const top = index*34+window.screen.availTop;
              const left = index*16;
              const width =  screenWidth-left-(windows.length-index)*10;
              const height = screenHeight-40;
              try{
                chrome.windows.update(item.id, {top,left,width,height,focused:true})
              }catch (e) {
                console.log(e,'update')
              }
            })
          });
        })
        break;
    }
})


const setting = {
    moveToSameWindow: true,
};

const newTabUrl = 'chrome://newtab/';

const tabRef = {}

chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab) {
    if(changeInfo.status!=='loading') {
      return
    };
    if(tab.openerTabId){
        tabRef[tabId] = tab.openerTabId;
    }
    const valid = tab.url.indexOf('http') > -1;
    if(!valid){
        chrome.browserAction.setIcon({
          path:'images/icon-32-disable.png',
          tabId:tab.id
        });
    }
    else{
        chrome.browserAction.setIcon({
          path:'images/icon-32.png',
          tabId:tab.id
        })
    }

    chrome.tabs.query({}, function (result){
        let index = undefined;
        let targetWindowId = undefined;
        let targetTabId = undefined;
        for(let i=0;i<result.length;i++){
          const item = result[i];
          if(item.url===tab.url && tab.url!==newTabUrl && item.id!==tab.id){
            index = item.index;
            targetWindowId = item.windowId;
            break;
          }
        }

        if(setting.moveToSameWindow && targetWindowId && index!==undefined) {
          // chrome.tabs.move(tabId, {windowId:targetWindowId,index:index});
          // 聚焦到目标窗口,并定位到目标tab
          chrome.windows.update(targetWindowId, {focused:true},function(){
            // TODO 然后将目标窗口移动到此窗口位置上
            chrome.tabs.highlight({windowId:targetWindowId, tabs:[index]},function () {
              chrome.tabs.remove([tabId])
              // else{
              //   chrome.tabs.update(tabId,{url:newTabUrl},function () {
              //
              //   });
              // }
            });
          })
        }

      // chrome.tabs.captureVisibleTab(result[0].windowId,{}, function(result){
      //     // console.log('image',result)
      // })

    });
});


function getDomain(url){
   const matchresult =  url.match(/^https?:\/\/([^\/]*)/i) [url];

}
