import regeneratorRuntime from "regenerator-runtime";
import { h, app } from "hyperapp";
import { Link, Route, location, Switch } from "@hyperapp/router";
import axios from 'axios';
const ethers = require('ethers');
const { utils, Wallet } = require('ethers');
const { sendTransaction, balanceOf, call, Eth, onReceipt } = require('ethjs-extras');
import styled from 'hyperapp-styled-components';

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

// define initial app state
const state = {
  location: location.state,
  error: null,
  results: [
    'Welcome to EthToolBox brought to you by Ethers.js, the Eth Community and Nick Dodson ;)',
    'Tip: you can access Ethers directly using Eval e.g. ethers.utils.bigNumberify("12").toHexString()',
  ],
  errors: [],
};

var editor;

// localmemory storage
let localMemory = {};

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
  },
  keccak256: () => (state, actions) => {
    try {
      actions.result(`keccak256("${state.inputA || ''}") => ${utils.keccak256(utils.solidityPack(['string'], [state.inputA || '']))}`);
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
  eval: () => (state, actions) => {
    try {
      actions.result(`eval("${state.inputB || ''}") => ${eval(state.inputB || '')}`);
    } catch (error) { actions.error(error); }
  },
  error: val => (state, actions) => {
    actions.result(String(val.message));
  },
  change: obj => obj,
};

const trimHexPrefix = val => String(val).indexOf('0x') === 0 ? String(val).slice(2) : val;

// no operation
const noop = () => {};

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

// are you sure message for unload.
window.onbeforeunload = function(e) {
  return 'Are you sure you want to close this tab. Data could be lost!';
};

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
  height: 75%;
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
  margin-top: 30px;
  width: 100%;
  position: absolute;
  padding: 20px;
  bottom: 0px;
  height: 25%;
  right: 0px;
  left: 0px;
  overflow: scroll;
`;

const Column = styled.div`
  margin-left: 20px;
`;

const Code = () => (state, actions) => (
  <div>
    <Wrapper>
      <Column style="display: flex; flex-direction: column; width: 500px;">
        <h1>EthToolBox</h1>
        <small style="margin-top: -15px"><i>built with <a href="https://github.com/ethers-io/ethers.js" target="_blank">ethers.js</a></i></small>
        <div>
          <br />
          <h4>String & Hex Tools</h4>
          <div style="position: relative;">
            <TextArea oninput={e => actions.change({ inputA: String(e.target.value || '').trim() })} placeholder="input string or hex data"></TextArea>
            <div style="position: absolute; bottom: 10px; right: 10px;">{trimHexPrefix(state.inputA || '').length / 2} bytes</div>
          </div>
          <br />
          <Button onclick={actions.sha256}>Sha256</Button>
          <Button onclick={actions.keccak256}>Keccak256</Button>
          <Button onclick={actions.utf8}>UTF8</Button>
          <Button onclick={actions.hex}>Hex</Button>
          <Button onclick={actions.sig}>Sig</Button>

          <br /><br /><br />

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
        </div>
      </Column>

      <Column>
        <h3>Current Unix Timestamp</h3>
        <div>{Math.round(new Date().getTime()/1000)} <small style="cursor: pointer; user-select: none;" onclick={e => actions.change({})}>refresh</small></div>
      </Column>
    </Wrapper>

    <Results>{state.results.concat(state.errors).reverse()
      .map((v, i) => (<div style="margin-top: 10px;">{state.results.concat(state.errors).length - i}) {v}</div>))}</Results>
  </div>
);

// routes for app
const Routes = () => (
  <Switch>
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
