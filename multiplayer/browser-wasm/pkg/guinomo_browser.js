/* @ts-self-types="./guinomo_browser.d.ts" */
import * as wasm from "./guinomo_browser_bg.wasm";
import { __wbg_set_wasm } from "./guinomo_browser_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    IntoUnderlyingByteSource, IntoUnderlyingSink, IntoUnderlyingSource, RoomChannel, RoomSender, SummerNode, start
} from "./guinomo_browser_bg.js";
