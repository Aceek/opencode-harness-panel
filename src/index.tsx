import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { resolveConfig } from "./config"
import { HarnessPanel } from "./panel"

const id = "opencode-harness-panel"

const tui: TuiPlugin = async (api, options) => {
  const config = resolveConfig(options)
  api.slots.register({
    order: 250,
    slots: {
      sidebar_content(_ctx, props) {
        return <HarnessPanel api={api} sessionID={props.session_id} config={config} />
      },
    },
  })
}

const plugin: TuiPluginModule = {
  id,
  tui,
}

export default plugin
