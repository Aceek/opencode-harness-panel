import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

const id = "opencode-harness-panel"

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 250,
    slots: {
      sidebar_content() {
        return (
          <box>
            <text fg={api.theme.current.text}>
              <b>Harness</b>
            </text>
            <text fg={api.theme.current.textMuted}>Plugin scaffold ready</text>
          </box>
        )
      },
    },
  })
}

const plugin: TuiPluginModule = {
  id,
  tui,
}

export default plugin
