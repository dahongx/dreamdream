import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n/client";
import { zh } from "@/i18n/zh";
import { FloatingSlot } from "../FloatingSlot";

test("native image drawer gets its source-size viewport and remains opaque", () => {
  const content =
    '<details class="mufy-side-r"><summary class="mufy-side-btn"><img class="mufy-side-icon" src="https://example.com/source.png"></summary><div class="mufy-side-panel"><div class="mufy-side-inner"></div></div></details>';
  const rendered = renderToStaticMarkup(
    <I18nProvider locale="zh-TW" dict={zh}>
      <FloatingSlot
        {...{
          components: [
            {
              id: "source-drawer",
              packId: "fixture",
              name: "drawer",
              content,
              enabled: true,
              orderIndex: 0,
              createdAt: new Date(0),
              updatedAt: new Date(0),
              slotValues: {},
            },
          ],
          character: {
            id: "fixture",
            name: "Fixture",
            avatarUrl: null,
            tags: [],
            bio: null,
          },
          userName: "Fixture user",
          onSendMessage: () => {},
        }}
      />
    </I18nProvider>,
  );
  expect(rendered).toContain("top-[8vh]");
  expect(rendered).toContain("h-[60px] w-[61px]");
  expect(rendered).toContain("width:48px!important");
  expect(rendered).toContain("height:48px!important");
  expect(rendered).toContain('sandbox="allow-scripts"');
  expect(rendered).not.toContain("allow-same-origin");
  expect(rendered).toContain("details.mufy-side-r");
});
