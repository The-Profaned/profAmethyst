package net.titan.sample;

import net.titan.api.config.Config;
import net.titan.api.config.ConfigButton;
import net.titan.api.config.ConfigGroup;
import net.titan.api.config.ConfigItem;
import net.titan.api.config.MatrixRow;

@ConfigGroup("java_sample")
public interface SamplePluginConfig extends Config {
    @ConfigItem(
        keyName = "verbose",
        name = "Verbose logging",
        description = "Log a short message every game tick."
    )
    default boolean verbose() {
        return true;
    }

    @ConfigItem(
        keyName = "highlightColor",
        name = "Highlight color",
        description = "Color used for the nearest-NPC hull.",
        color = true
    )
    default int highlightColor() {
        return 0xFF00FF00;
    }

    @ConfigItem(
        keyName = "maxNpcDistance",
        name = "Max NPC distance",
        description = "Highlight NPCs within this radius.",
        min = 1,
        max = 32
    )
    default int maxNpcDistance() {
        return 10;
    }

    // A checkbox grid. Each row names the columns it actually has, so the two
    // columns Chicken and Goblin omit render as blank gaps and can never be
    // checked. `checked` seeds the initial state. Unlike every other config
    // item this method is ABSTRACT: the grid's cells and defaults come from the
    // annotation, so there is no body to read a default from.
    // Read a cell as config.npcActions()[GUARD][HIGHLIGHT].
    @ConfigItem(
        keyName = "npcActions",
        name = "NPC actions",
        description = "Per-NPC toggles. Chickens cannot be announced.",
        columns = {"Highlight", "Announce", "Tile"},
        rows = {
            @MatrixRow(label = "Guard", cells = {"Highlight", "Announce", "Tile"},
                       checked = {"Highlight"}),
            @MatrixRow(label = "Goblin", cells = {"Highlight", "Announce"}),
            @MatrixRow(label = "Chicken", cells = {"Highlight", "Tile"},
                       checked = {"Tile"}),
        }
    )
    boolean[][] npcActions();

    int GUARD = 0, GOBLIN = 1, CHICKEN = 2;
    int HIGHLIGHT = 0, ANNOUNCE = 1, TILE = 2;

    @ConfigItem(
        keyName = "watchedItem",
        name = "Watched item",
        description = "Item whose cache definition is logged each tick."
    )
    default WatchedItem watchedItem() {
        return WatchedItem.COINS;
    }

    // A value-less action button. The method body runs when the button is
    // clicked in the config UI (on the game thread, including the login
    // screen). The config proxy has no injected services, so delegate to a
    // static entry point the plugin publishes.
    @ConfigButton(
        keyName = "logStateNow",
        name = "Log state now",
        description = "Log the current tick and NPC count."
    )
    default void logStateNow() {
        SamplePlugin.logStateFromButton();
    }

    enum WatchedItem {
        COINS(995),
        SHARK(385),
        RUNE_SCIMITAR(1333);

        private final int itemId;

        WatchedItem(int itemId) {
            this.itemId = itemId;
        }

        public int itemId() {
            return itemId;
        }
    }
}
