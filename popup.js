function sendMessage(req,cb) {
    chrome.tabs.getSelected(null, function(tab) {
        chrome.tabs.sendMessage(tab.id, req, function(response) {
            response = response || {success:false,errMsg:'通信失败，请重试'}
            typeof cb === 'function' && cb(response)
        });
    });
}




class Frames extends React.Component{

    constructor(props){
        super(props)
        this.state = {
            frames:[],
            mainPage:{alpha:1},
            activeFrame:'',
            errorMsg:'',
            otherTabs:[]
        }
        this.setActive = this.setActive.bind(this)
        this.changeAlpha = this.changeAlpha.bind(this)
        this.toggleShowButton = this.toggleShowButton.bind(this)
        this.initPage = this.initPage.bind(this)
        this.closeOthers = this.closeOthers.bind(this)
        this.shutTogetherTabs = this.shutTogetherTabs.bind(this)
        this.popupFrames = this.popupFrames.bind(this)
        this.addTabToFrames = this.addTabToFrames.bind(this)
    }

    render(){
        if(!this.state.mainPage.url){
            return (
                <div>
                    <div>
                        无法聚合到本页面，原因：本页无网页内容。
                        <hr/>
                        解决：输入网址访问任意网页
                    </div>
                </div>
            )
        }
        return (
            <div>
                <div className='tabs-handler'>
                    <button disabled={this.state.otherTabs.length===0} onClick={this.shutTogetherTabs}>聚合{this.state.otherTabs.length?this.state.otherTabs.length+'个':''}标签页</button>
                    <span>
                    {
                        this.state.otherTabs.map((tab,index)=>
                            <span onClick={()=>this.addTabToFrames(tab)} className='other-tab-icon' key={index} title={'点击添加：'+tab.title}><img width={14} height={14} src={tab.favIconUrl}/></span>
                        )
                    }
                </span>
                </div>
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
                                    <label className='src-info'>
                                        <aside style={{backgroundImage: 'url("'+frame.favicon+'")',
                                            width:'14px',height:'14px',backgroundSize:'contain',display:'inline-block',
                                            verticalAlign:'sub'

                                        }}>
                                        </aside>
                                        <input checked={this.state.mainPage.activeIndex === index} onChange={()=>this.setActive(index)} name='activeFrame' type='radio' value={frame.src} />
                                        <span className="link-src" >{frame.src}</span>
                                    </label>
                                </td>
                                <td>
                                    <a href={frame.src} target="_blank">打开</a>
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
                            <label className='src-info'>
                                <aside style={{backgroundImage: 'url("'+this.state.mainPage.favicon+'")',
                                    width:'14px',height:'14px',backgroundSize:'contain',display:'inline-block',
                                    verticalAlign:'sub'
                                }}>
                                </aside>
                                <input checked={this.state.mainPage.activeIndex===-1} onChange={()=>this.setActive(-1)} name='activeFrame' type='radio'/>
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
                    <input type="checkbox" onChange={this.toggleShowButton} value={this.state.mainPage.showButton} checked={this.state.mainPage.showButton}/> 显示按钮
                </div>

                <div>
                    {this.state.errorMsg}
                </div>
            </div>
        )
    }

    componentDidMount(){
        this.initPage();
    }

    initPage() {
        const that = this;
        chrome.tabs.getAllInWindow(null, function(result){
            console.log(result)
            const tabs = []
            result.forEach((tab)=>{
                if(tab.active===false && tab.url.indexOf('http')>-1 && tab.title.indexOf('聚合页：')===-1){
                    tabs.push(tab)
                }
            })
            that.setState({
                otherTabs:tabs
            })
        })

        sendMessage({type:'getInfos'},function (result) {
            if(result.success){
                that.setState({
                    frames: result.frames,
                    mainPage: result.mainPage
                })
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
            if(result.success){
                this.initPage()
            }
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
        const closeTabs = this.state.otherTabs.map((tab)=>tab.id)
        const frames = this.state.otherTabs.map((tab)=>{
                return  {   url:tab.url,
                            favicon:tab.favIconUrl
                        }
            }
        )
        chrome.tabs.remove(closeTabs,()=>{
            sendMessage({type:'addFrames',frames: frames}, (resp)=> {
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
        });
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
            <input className="link-input"  value={this.state.value} onChange={(event)=>{this.setState({value:event.target.value})}}  type="text" placeholder="请输入url"/>
            <button id="add-frame" onClick={this.addFrames}>添加</button>
            <div style={{color:'red'}}>
                {this.state.errMsg}
            </div>
            </div>)

    }

    addFrames(){
        sendMessage({type:'addFrames',urls:[this.state.value]}, (resp)=> {
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
