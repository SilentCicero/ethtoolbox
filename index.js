import regeneratorRuntime from "regenerator-runtime";
import { h, app } from "hyperapp";
import { Link, Route, location, Switch } from "@hyperapp/router";
import axios from 'axios';
const ethers = require('ethers');
const { utils, Wallet } = require('ethers');
const { sendTransaction, balanceOf, call, Eth, onReceipt } = require('ethjs-extras');
import styled from 'hyperapp-styled-components';
import moment from 'moment';

// change global style..
styled.injectGlobal`
  body {
    padding: 0px;
    margin: 0px;
    overflow: hidden;
    font-family: Monaco, Menlo, Consolas, source-code-pro, monospace;
  }

  textarea {
    font-family: Monaco, Menlo, Consolas, source-code-pro, monospace;
  }
`;

// standard route method
const route = pathname => {
  window.scrollTo(0, 0);
  history.pushState(null, "", pathname);
};

// define initial app state
const state = {
  location: location.state,
  error: null,
  results: [
    (<span>Welcome to EthToolBox brought to you by Ethers.js, the Eth Community and Nick Dodson <a href="https://twitter.com/iamnickdodson" target="_blank">@IAmNickDodson</a> ;)</span>),
    'Tip: you can access Ethers directly using the console e.g. ethers.utils.bigNumberify("12").toHexString()',
  ],
  abi: {},
  timestamp: Math.round(new Date().getTime()/1000),
  timestring: (new Date()).toLocaleString(undefined, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }),
  errors: [],
};

var editor;

// localmemory storage
let localMemory = {};

const stripHex = v => String(v).indexOf('0x') === 0 ? String(v).slice(2) : v;

// localstorage
const local = window.localStorage || {
  setItem: (key, value) => Object.assign(localMemory, { [key]: value }),
  getItem: key => localMemory[key] || null,
};

// define initial actions
const actions = {
  location: location.actions,
  load: () => (state, actions) => {},
  dark: () => (state, actions) => {
    var darky = !state.dark;
    actions.change({ dark: darky });

    if (darky) {
      document.body.style.background = 'rgb(39, 40, 34)';
    } else {
      document.body.style.background = '#FFF';
    }
  },
  result: val => (state, actions) => {
    actions.change({ results: state.results.concat([val]) });
    const elm = document.getElementById('results');

    // scroll to bottom
    setTimeout(e => {(elm.scrollTop = elm.scrollHeight)}, 50);
  },
  onAbi: val => (state, actions) => {
    try {
      const inter = new ethers.utils.Interface([val]);

      actions.change({
        methodString: val,
        methodHash: inter.functions[inter.abi[0].name].sighash,
        abi: inter.abi,
      });
    } catch (error) {
      actions.change({ abiError: error.message });
    }
  },
  encode: () => (state, actions) => {
    try {
      const args = state.abi[0].inputs.map(
        (v, i) => (v.type.indexOf('[') !== -1 ? JSON.parse : noop1)(document.getElementById(`arg${i}`).value));
      const method = (new ethers.utils.Interface([state.abi[0]])).functions[state.abi[0].name];
      const encoded = method.encode(args);

      actions.result((<div>{`
        ${state.methodString}`}<br />{`${state.abi[0].name}(${args.join(', ')}) => `} <br /><br /><b>{encoded}</b></div>));
    } catch (error) { actions.error(error); }
  },
  keccak256: () => (state, actions) => {
    try {
      if (String(state.inputA).indexOf('0x') === 0) {
        actions.result(`keccak256("${state.inputA || ''}") => ${
          utils.keccak256(state.inputA || '')}`);
      } else {
        actions.result(`keccak256(solidityPack("${state.inputA || ''}")) => ${
          utils.keccak256(utils.solidityPack(['string'], [state.inputA || '']))}`);
      }
    } catch (error) { actions.error(error); }
  },
  break32: () => (state, actions) => {
    try {
      actions.result((<div>{`break("${state.inputA || ''}") => `} {stripHex(state.inputA || '').match(/.{0,64}/g).map((v, i) => (<div><span style="min-width: 30px; display: inline-block;">{i}|{i * 32}</span> {v}</div>))}</div>));
    } catch (error) { actions.error(error); }
  },
  sha256: () => (state, actions) => {
    try {
      actions.result(`sha256("${state.inputA || ''}") => ${utils.sha256(utils.solidityPack(['string'], [state.inputA || '']))}`);
    } catch (error) { actions.error(error); }
  },
  sig: () => (state, actions) => {
    try {
      actions.result(`bytes4(keccak256("${state.inputA || ''}")) => ${utils.keccak256(utils.solidityPack(['string'], [state.inputA || ''])).slice(0, 10)}`);
    } catch (error) { actions.error(error); }
  },
  hex: () => (state, actions) => {
    try {
      actions.result(`hex("${state.inputA || ''}") => ${utils.hexlify(utils.toUtf8Bytes(state.inputA || ''))}`);
    } catch (error) { actions.error(error); }
  },
  toInt: () => (state, actions) => {
    try {
      actions.result(`BN("${state.inputB || ''}").toString(10) => ${utils.bigNumberify(state.inputB || '').toString(10)}`);
    } catch (error) { actions.error(error); }
  },
  toWei: () => (state, actions) => {
    try {
      actions.result(`wei(ether("${state.inputB || ''}")) => ${utils.parseEther(state.inputB || '')} wei`);
    } catch (error) { actions.error(error); }
  },
  toGWei: () => (state, actions) => {
    try {
      actions.result(`gwei("${state.inputB || ''}") => ${utils.parseUnits(state.inputB || '', 'gwei')} wei`);
    } catch (error) { actions.error(error); }
  },
  toEther: () => (state, actions) => {
    try {
      actions.result(`wei("${state.inputB || ''}") => ${utils.formatEther(state.inputB || '')} ether`);
    } catch (error) { actions.error(error); }
  },
  pad32Left: () => (state, actions) => {
    try {
      actions.result(`pad32("${state.inputB || ''}") => ${utils.hexZeroPad(state.inputB || '', 32)}`);
    } catch (error) { actions.error(error); }
  },
  generateKey: () => (state, actions) => {
    try {
      let privateKey = utils.randomBytes(32);
      let wallet = new ethers.Wallet(privateKey);

      actions.result((<div>new Wallet() => [ <br />
        Private Key: <br /> <b>{wallet.privateKey}</b> <br /> <br />
        Address: <br /> <b>{wallet.address}</b> <br />
      ]</div>));
    } catch (error) { actions.error(error); }
  },
  bignumber: () => (state, actions) => {
    try {
      actions.result(`BN("${state.inputB || ''}").toString(10) => ${utils.hexlify(utils.bigNumberify(state.inputB || ''))}`);
    } catch (error) { actions.error(error); }
  },
  utf8: () => (state, actions) => {
    try {
      actions.result(`utf8("${state.inputA || ''}") => ${utils.toUtf8String(state.inputA || '')}`);
    } catch (error) { actions.error(error); }
  },
  console: val => (state, actions) => {
    try {
      actions.result(`${eval(val)}`);
    } catch (error) { actions.error(error); }
  },
  time: val => (state, actions) => {
    try {
      actions.change({ timestring: val, timestamp: moment(val).format('X'), });
    } catch (error) {
      actions.change({ timestring: val });
    }
  },
  entropy: len => (state, actions) => {
    try {
      actions.result(`randomBytes(${len}) => ${utils.hexlify(utils.randomBytes(len))}`);
    } catch (error) {
    }
  },
  sign: obj => async (state, actions) => {
    try {
      const splitSig = (new ethers.utils.SigningKey(obj.privateKey)).signDigest(obj.message);
      actions.result((<div>{`sign(${obj.privateKey}, ${obj.message}) =>`}
        <br /><br />
        Packed: <br />
        {utils.joinSignature(splitSig)}

        <br /><br />
        Split: <br />
        {JSON.stringify(splitSig, null, 2)}

        <br /><br />
        Solidity: <br />
        0x{utils.hexZeroPad(utils.hexlify(splitSig.v), 32).slice(2)}{splitSig.r.slice(2)}{splitSig.s.slice(2)}
      </div>));
    } catch (error) { actions.error(error); }
  },
  eval: () => (state, actions) => {
    try {
      actions.result(`eval("${state.inputB || ''}") => ${eval(state.inputB || '')}`);
    } catch (error) { actions.error(error); }
  },
  ensHash: val => (state, actions) => {
    try {
      actions.result(`namehash(${val}) => ${utils.namehash(val)}`);
    } catch (error) {
    }
  },
  error: val => (state, actions) => {
    actions.result(String(val.message));
  },
  change: obj => obj,
};

const trimHexPrefix = val => String(val).indexOf('0x') === 0 ? String(val).slice(2) : val;

// no operation
const noop = () => {};
const noop1 = v => v;

// provider
let provider = window.ethereum || (window.web3 || {}).currentProvider;

// provider..
const eth = Eth({ provider });

// server url
const serverURL = 'https://api.nickpay.com';

// json params for axios
const post = (url, data) => axios.post(serverURL + url, JSON.stringify(data));

// null token address
const nullAddress = '0x0000000000000000000000000000000000000000';

// who will get the fee
const feeRecipient = '0x0000000000000000000000000000000000000000';

// shorthand
const keccak256 = utils.keccak256;
const encodePacked = utils.solidityPack;
const abiEncode = encodePacked;

// lower case it
const lower = v => String(v).toLowerCase();

// Not found page
const NotFound = () => (
  <div style={{ padding: '20%', 'padding-top': '100px' }}>
    <h1>Cool kids?</h1>
    <h3>Hmm... Page not found</h3>
  </div>
);

const Wrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 53%;
  position: absolute;
  overflow: scroll;
  left: 0px;
  top: 0px;
  bottom: 0px;
  flex-wrap: wrap;
`;

const TextArea = styled.textarea`
  padding: 10px;
  margin-top: 10px;
  width: 100%;
  height: 70px;
`;

const Button = styled.button`
  font-weight: bold;
  margin-top: 10px;
  padding: 15px;
  margin-right: 10px;
`;

const Results = styled.div`
  width: 40%;
  position: absolute;
  word-wrap: break-word;
  padding: 20px;
  bottom: 50px;
  top: 0px;
  right: 0px;
  overflow: scroll;
  overflow-x: hidden;
`;

const Console = styled.input`
  position: absolute;
  display: block;
  line-height: 15px;
  padding-top: 0px;
  bottom: 0px;
  height: 40px;
  margin-bottom: 10px;
  right: 35px;
  padding-right: 20px;
  padding-left: 23px;
  border: 0px;
  letter-spacing: .5px;
  font-size: 15px;
  width: 40%;
  outline: none;
  background: url(https://png.pngtree.com/svg/20160727/0bf24b248b.svg);
  background-position: 0px 10px;
  background-repeat: no-repeat;
  background-size: 20px 20px;

  &:focus {
    color: none;
    outline: none;
  }
`;

const Column = styled.div`
  margin-left: 20px;
  padding-bottom: 100px;
`;

const Buttons = styled.div`
  margin-top: 40px;
  margin-bottom: 80px;
`;

const PageButton = styled.span`
  margin-right: 20px;
  margin-bottom: 40px;
  border-right: 1px solid #333;
  cursor: pointer;
  padding-right: 20px;
  text-decoration: none;
  margin-bottom: 20px;

  &:hover {
    color: blue;
  }
`;

const Code = () => (state, actions, v = console.log(state)) => (
  <div style="width: 100%;">
    <Wrapper>
      <Column style="display: flex; flex-direction: column; width: 500px;">
        <h1>EthToolBox</h1>
        <small style="margin-top: -15px"><i>built with <a href="https://github.com/ethers-io/ethers.js" target="_blank">ethers.js</a> and <a href="https://github.com/ethjs" target="_blank">ethjs</a></i></small>
        <div>

          <Buttons>
            <PageButton onclick={e => route('/hex')}>Hex</PageButton>
            <PageButton onclick={e => route('/number')}>Number</PageButton>
            <PageButton onclick={e => route('/abi')}>ABI</PageButton>
            <PageButton onclick={e => route('/date')}>Date/Time</PageButton>
            <PageButton onclick={e => route('/entropy')}>Entropy</PageButton>
            <PageButton onclick={e => route('/ens')}>ENS</PageButton>
            <PageButton onclick={e => route('/keys')}>Signatures</PageButton>
          </Buttons>

          <Route path="/" render={() => () => (
            <div>
              <h4>String & Hex Tools</h4>
              <div style="position: relative;">
                <TextArea oninput={e => actions.change({ inputA: String(e.target.value || '').trim() })} placeholder="input string or hex data"></TextArea>
                <div style="position: absolute; bottom: 10px; right: 10px;">{trimHexPrefix(state.inputA || '').length / 2} bytes</div>
              </div>
              <br />
              <Button onclick={actions.keccak256}>Keccak256</Button>
              <Button onclick={actions.sha256}>Sha256</Button>
              <Button onclick={actions.utf8}>UTF8</Button>
              <Button onclick={actions.hex}>Hex</Button>
              <Button onclick={actions.sig}>Sig</Button>
              <Button onclick={actions.break32}>Break(32)</Button>
            </div>
          )} />

          <Route path="/hex" render={() => () => (
            <div>
              <h4>String & Hex Tools</h4>
              <div style="position: relative;">
                <TextArea oninput={e => actions.change({ inputA: String(e.target.value || '').trim() })} placeholder="input string or hex data"></TextArea>
                <div style="position: absolute; bottom: 10px; right: 10px;">{trimHexPrefix(state.inputA || '').length / 2} bytes</div>
              </div>
              <br />
              <Button onclick={actions.keccak256}>Keccak256</Button>
              <Button onclick={actions.sha256}>Sha256</Button>
              <Button onclick={actions.utf8}>UTF8</Button>
              <Button onclick={actions.hex}>Hex</Button>
              <Button onclick={actions.sig}>Sig</Button>
              <Button onclick={actions.break32}>Break(32)</Button>
            </div>
          )} />

          <Route path="/number" render={() => () => (
            <div>
              <h4>Number Tools</h4>
              <div style="position: relative;">
                <TextArea oninput={e => actions.change({ inputB: String(e.target.value || '').trim() })} placeholder="number data"></TextArea>
                <div style="position: absolute; bottom: 10px; right: 10px;">{trimHexPrefix(state.inputB || '').length / 2} bytes</div>
              </div>

              <Button onclick={actions.eval}>Eval</Button>
              <Button onclick={actions.toInt}>.toString(10)</Button>
              <Button onclick={actions.bignumber}>.toString(16)</Button>
              <Button onclick={actions.toWei}>Ether</Button>
              <Button onclick={actions.toGWei}>Gwei</Button>
              <Button onclick={actions.toEther}>Wei</Button>
              <Button onclick={actions.pad32Left}>Pad32(Left)</Button>
            </div>
          )} />

          <Route path="/abi" render={() => () => (
            <div>
              <h4>ABI Tools</h4>
              <div style="position: relative;">
                <input type="text" id="abi" style="padding: 15px;" oninput={e => actions.onAbi(e.target.value.trim().replace(/memory|calldata/g, '').replace(/;/g, ""))} placeholder="transfer(address to, uint tokens)" />

                {Object.keys(state.abi, console.log(state.abi)).length ? (<div>  <br />
                  <h3>{state.abi[0].name} <small>{state.methodHash}</small></h3> <br />
                  {state.abi[0].inputs.map((arg, index) => (<div>
                    <b>{arg.name || `Argument ${index}`}</b><br />
                    <input type="text" id={`arg${index}`} style="padding: 15px;" placeholder={arg.type} /> <br /> <br />
                  </div>))}

                  <Button onclick={actions.encode}>Encode</Button>
                  <Button onclick={e => {
                    (document.getElementById('abi').value = '');
                    actions.change({ abi: {}, methodString: '', abiError: null })
                  }}>Clear</Button>
                </div>) : (<div><br />{state.abiError}</div>)}

                <br /><br />
              </div>
            </div>
          )} />

          <Route path="/date" render={() => () => (
            <div>
              <h3>Date Tools (UTC)</h3>
              <div><input type="text" style="padding: 20px;" value={state.timestring} oninput={e => actions.time(e.target.value)} /></div>
              <br />
              <div>{state.timestamp} <small style="cursor: pointer; user-select: none;" onclick={e => actions.time((new Date()).toLocaleString(undefined, {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
              }))}>refresh</small></div>
            </div>
          )} />

          <Route path="/entropy" render={() => () => (
            <div>
              <h3>Entropy Tools</h3>
              <Button onclick={e => actions.entropy(20)}>20 Bytes</Button>
              <Button onclick={e => actions.entropy(32)}>32 Bytes</Button>
              <Button onclick={e => actions.entropy(128)}>128 Bytes</Button>
            </div>
          )} />

          <Route path="/ens" render={() => () => (
            <div>
              <h3>ENS Tools</h3>
              <input type="text" style="padding: 15px; margin-right: 10px;" state={state.ensName || ''} oninput={e => actions.change({ ensName: e.target.value || '' })} placeholder="ricmoo.firefly.eth" />
              <Button onclick={e => actions.ensHash(state.ensName)}>Hash</Button>
            </div>
          )} />

          <Route path="/keys" render={() => () => (
            <div>
              <h4>Key Tools</h4>
              <Button onclick={actions.generateKey}>Generate</Button>

              <br /><br /><br /><br />

              <b>Sign Message</b> <br /><br />
              <input type="text" id="privKey" style="padding: 15px;" placeholder="private key" />
              <input type="text" id="message" style="padding: 15px;" placeholder="message" /> <br /><br />
              <Button onclick={() => actions.sign({
                privateKey: document.getElementById('privKey').value,
                message: document.getElementById('message').value,
              })}>Sign</Button>
            </div>
          )} />

        </div>
      </Column>
    </Wrapper>

    <Results id="results">{state.results.concat(state.errors)
      .map((v, i) => (<div style="margin-top: 10px;">{i + 1}) {v}</div>))}</Results>

    <Console placeholder="" onkeyup={e => {
      if (e.keyCode === 13) {
        e.preventDefault();
        actions.console(e.target.value);
      }
    }}></Console>
  </div>
);

// routes for app
const Routes = () => (
  <Switch>
    <Route path="/number" render={Code} />
    <Route path="/abi" render={Code} />
    <Route path="/hex" render={Code} />
    <Route path="/date" render={Code} />
    <Route path="/entropy" render={Code} />
    <Route path="/keys" render={Code} />
    <Route path="/ens" render={Code} />
    <Route path="/" render={Code} />
    <Route render={NotFound} />
  </Switch>
);

// main app
const main = app(
  state,
  actions,
  Routes,
  document.body,
);

// unsubscripe for routing
const unsubscribe = location.subscribe(main.location);
