function sendMessage(req,cb) {
    chrome.tabs.getSelected(null, function(tab) {
        const tabid = req.targetTabId || tab.id;
        const defualtResp = {success:false,errMsg:'通信失败'}
        if(!req.targetTabId && tab.url.indexOf('http')===-1){
            console.log('找不到通信目标');
            typeof cb === 'function' && cb(defualtResp);
            return;
        }
        chrome.tabs.sendMessage(tabid, req, function(response) {
            response = response || defualtResp
            typeof cb === 'function' && cb(response)
        });
    });
}


class Frames extends React.Component{

    constructor(props){
        super(props)
        this.state = {
            frames:[],
            mainPage:null,
            errorMsg:'',
            otherTabs:[],
            allTabs:[],
            targetTabId: null,
            currentTabId: null,
        }
        this.setActive = this.setActive.bind(this)
        this.changeAlpha = this.changeAlpha.bind(this)
        this.toggleShowButton = this.toggleShowButton.bind(this)
        this.initPage = this.initPage.bind(this)
        this.closeOthers = this.closeOthers.bind(this)
        this.shutTogetherTabs = this.shutTogetherTabs.bind(this)
        this.popupFrames = this.popupFrames.bind(this)
        this.addTabToFrames = this.addTabToFrames.bind(this)
        this.changeShowType = this.changeShowType.bind(this)
    }

    render(){
        return (
            <div>
                <div className='tabs-handler'>
                    <div className='tabs-container'>
                        <div>
                        {
                            this.state.allTabs.map((tab,index)=>{
                                if(tab.id !== this.state.currentTabId){
                                    return  <a href="javascript:;" onClick={()=>this.addTabToFrames(tab)}
                                               className='site-favicon'
                                               key={index}
                                               title={'点击添加：'+tab.title}>
                                        <img className='icon-image' width={14} height={14} src={tab.favIconUrl}/>
                                    </a>
                                }else {
                                    return <span className='active-tab' key={index}>
                                                {
                                                    this.state.mainPage ?
                                                        <span>
                                                            {
                                                                this.state.otherTabs.length ?
                                                                    <button onClick={this.shutTogetherTabs}>
                                                                        聚合所有
                                                                    </button>:
                                                                    <AddSection/>
                                                            }
                                                        </span>
                                                        :
                                                        <button onClick={this.shutTogetherTabs}>
                                                            聚合所有tab
                                                        </button>
                                                }
                                            </span>
                                }
                            })
                        }
                        </div>

                    </div>
                </div>

                {
                    this.state.mainPage &&
                    <section>
                        <table>
                            <thead>
                            <tr>
                                <th>不透明度</th>
                                <th>网址</th>
                                <th style={{width:'90px'}}>操作</th>
                            </tr>
                            </thead>

                            <tbody>
                            {
                                this.state.frames.map((frame,index)=>
                                    <tr key={frame.src+index}>
                                        <td>
                                            <input type="range" max={100} min={-1} value={frame.alpha*100} onChange={(event)=>this.changeAlpha(index,event.target.value)}/>
                                        </td>
                                        <td>
                                            <label className='src-info' onClick={()=>this.setActive(index)}>
                                                <aside className={`site-icon ${this.state.mainPage.activeIndex === index ? '' :'gray'}`} style={{backgroundImage: 'url("'+frame.favicon+'")',
                                                    width:'14px',height:'14px',backgroundSize:'contain',display:'inline-block',
                                                    verticalAlign:'sub'

                                                }}>
                                                </aside>
                                                <span className="link-src" >{frame.src}</span>
                                            </label>
                                        </td>
                                        <td>
                                            <a href={frame.src} target="_blank">弹出</a>
                                            <button  onClick={()=>this.deleteFrame(index)}>删除</button>
                                        </td>
                                    </tr>
                                )
                            }
                            <tr>
                                <td>
                                    <input type="range" max={100} min={-1} value={this.state.mainPage.alpha*100} onChange={(event)=>this.changeAlpha(-1,event.target.value)}/>
                                </td>
                                <td>
                                    <label className='src-info' onClick={()=>this.setActive(-1)}>
                                        <aside className={`site-icon ${this.state.mainPage.activeIndex === -1 ? '' :'gray'}`} style={{backgroundImage: 'url("'+this.state.mainPage.favicon+'")',
                                            width:'14px',height:'14px',backgroundSize:'contain',display:'inline-block',
                                            verticalAlign:'sub'
                                        }}>
                                        </aside>
                                        <span className="link-src">
                                    主页 {this.state.mainPage.url}
                                </span>
                                    </label>
                                </td>
                                <td>
                                    {
                                        this.state.frames.length>0 &&
                                        <div>
                                            <button onClick={this.closeOthers}>删除嵌入页</button>
                                            <button onClick={this.popupFrames}>弹出嵌入页</button>
                                        </div>
                                    }
                                </td>
                            </tr>
                            </tbody>
                        </table>
                        <div>
                            <div>
                                <input type="checkbox" onChange={this.toggleShowButton} value={this.state.mainPage.showButton} checked={this.state.mainPage.showButton}/> 显示按钮
                            </div>
                            <div>
                                布局方式：
                                <label htmlFor="">
                                    <input type="radio" onChange={this.changeShowType} name='showType' value="overlap" checked={this.state.mainPage.showType==='overlap'}/>
                                    重叠
                                </label>
                                <label htmlFor="">
                                    <input type="radio" onChange={this.changeShowType} name='showType' value="flat" checked={this.state.mainPage.showType==='flat'}/>
                                    平铺
                                </label>
                            </div>
                        </div>
                    </section>
                }
                <div>
                    {this.state.errorMsg}
                </div>
            </div>
        )
    }

    componentDidMount(){
        this.initPage();
        chrome.tabs.getSelected(null, (tab)=> {
            this.setState({
                currentTabId: tab.id,
            })
        })
    }

    initPage() {
        chrome.tabs.getAllInWindow(null,(result)=>{
            const tabs = []
            const allTabs = []
            result.forEach((tab)=>{
                if(tab.active===false && tab.url.indexOf('http')>-1 && tab.title.indexOf('聚合页：')===-1){
                    tabs.push(tab)
                }
                allTabs.push(tab)
            })
            this.setState({
                otherTabs: tabs,
                allTabs: allTabs,
            })
        })

        sendMessage({type:'getInfos'}, (result)=> {
            console.log(result)
            if(result.success){
                this.setState({
                    frames: result.frames,
                    mainPage: result.mainPage,
                    targetTabId: this.state.currentTabId,
                    hasMainPage: true,
                })
            }else{
                console.log('无主页信息')
            }
        })
    }

    setActive(index) {
        sendMessage({type:'setActive',activeIndex:index},(result)=>{
            if(result.success){
                this.initPage()
            }
        });
    }
    changeAlpha(index,alpha) {
        sendMessage({type:'setAlpha',frameIndex:index,alpha:alpha/100.00},(result)=> {
            this.initPage()
        });
    }
    deleteFrame(index) {
        sendMessage({type:'deleteFrame',frameIndex: index}, (result)=> {
            if(result.success){
                this.initPage();
            }
        })
    }
    toggleShowButton() {
        sendMessage({type:'toggleShowButton'},(result)=>{
            if(result.success){
                this.initPage()
            }else{
                this.setState({
                    errMsg:'通信失败'
                })
            }
        })
    }
    closeOthers() {
        sendMessage({type:'closeOthers'},(result)=>{
            if(result.success){
                this.initPage()
            }else{
                this.setState({
                    errMsg:'通信失败'
                })
            }
        })
    }
    shutTogetherTabs() {
        let targetTabid = this.state.targetTabId;
        targetTabid = targetTabid || this.state.otherTabs[0].id;
        const huntingTabs = []
        this.state.otherTabs.forEach((tab)=>{
            if(tab.id!==targetTabid){
                huntingTabs.push(tab)
            }
        })
        const closeTabIds = huntingTabs.map((tab)=>tab.id)
        const frames = huntingTabs.map((tab)=>{return {
            url:tab.url,
            favicon:tab.favIconUrl
        }})

        sendMessage({type:'addFrames',frames: frames,targetTabId: targetTabid}, (resp)=> {
            if(resp.success){
                this.setState({
                    errMsg:'添加成功'
                })
                if(!this.state.mainPage){
                    chrome.tabs.getSelected(null, function(tab) {
                        chrome.tabs.remove(tab.id)
                    });
                }
                chrome.tabs.remove(closeTabIds, ()=> {
                    this.initPage();
                });
            }else{
                this.setState({
                    errMsg: resp.errMsg || '添加失败'
                })
            }
        })
    }
    popupFrames() {
        this.closeOthers();
        this.state.frames.forEach((frame)=>{
            chrome.tabs.create({
                url:frame.src,
            })
        })
    }
    addTabToFrames(tab) {
        chrome.tabs.remove(tab.id);
        sendMessage({type:'addFrames',frames:[{
            url: tab.url,
            favicon: tab.favIconUrl
            }]}, (resp)=> {
            if(resp.success){
                this.setState({
                    errMsg:'添加成功'
                })
                this.initPage()
            }else{
                this.setState({
                    errMsg: resp.errMsg || '添加失败'
                })
            }
        })
    }
    changeShowType(e){
        sendMessage({type:'changeType',showType:e.target.value,},(resp)=>{
            this.initPage()
        })
    }
}

class AddSection extends React.Component{
    constructor(props){
        super(props)
        this.state={
            value:'https://www.',
            errMsg: ''
        }

        this.addFrames = this.addFrames.bind(this);
    }

    render(){
        return (<div>
            输入网址:
            <input className="link-input"  value={this.state.value} onChange={(event)=>{this.setState({value:event.target.value})}}  type="text" placeholder="请输入url"/>
            <button id="add-frame" onClick={this.addFrames}>添加</button>
            <div style={{color:'red'}}>
                {this.state.errMsg}
            </div>
            </div>)

    }

    addFrames(){
        sendMessage({type:'addFrames',frames:[{
                url:this.state.value,
            }]}, (resp)=> {
            if(resp.success){
                this.setState({
                    errMsg:'添加成功'
                })
                window.close()
            }else{
                this.setState({
                    errMsg: resp.errMsg || '添加失败'
                })
            }
        })
    }
}



ReactDOM.render(
    <div>
        <Frames/>
        {/*<AddSection/>*/}
    </div>,
    document.getElementById('popup')
);
