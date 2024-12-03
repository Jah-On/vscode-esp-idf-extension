/*
 * Project: ESP-IDF VSCode Extension
 * File Created: Sunday, 10th May 2020 11:33:22 pm
 * Copyright 2020 Espressif Systems (Shanghai) CO LTD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from "vscode";
import { isCurrentInstallValid } from "./setup/setupInit";
import { Logger } from "./logger/logger";
import { NotificationMode, readParameter } from "./idfConfiguration";
import { useIdfSetupSettings } from "./setup/setupValidation/espIdfSetup";
import { getIdfSetups, getSelectedEspIdfSetup } from "./eim/getExistingSetups";

export async function checkExtensionSettings(
  extensionPath: string,
  workspace: vscode.Uri,
  espIdfStatusBar: vscode.StatusBarItem
) {
  try {
    const isExtensionConfigured = await isCurrentInstallValid(workspace);
    if (isExtensionConfigured) {
      await vscode.commands.executeCommand("espIdf.welcome.start");
      return;
    }
    const espIdeJsonSelected = await getSelectedEspIdfSetup();
    if (espIdeJsonSelected && espIdeJsonSelected.isValid) {
      await useIdfSetupSettings(
        espIdeJsonSelected,
        vscode.ConfigurationTarget.WorkspaceFolder,
        workspace,
        espIdfStatusBar
      );
      return;
    }
  } catch (error) {
    const msg = error.message
      ? error.message
      : "Checking if current install is valid throws an error.";
    Logger.error(msg, error, "checkExtensionSettings");
  }
  const openESPIDfManager = vscode.l10n.t(
    "Open ESP-IDF Installation Manager"
  ) as string;
  const chooseExisting = vscode.l10n.t(
    "Choose from existing ESP-IDF setups."
  ) as string;
  const action = await vscode.window.showInformationMessage(
    vscode.l10n.t(
      "The extension configuration is not valid. Choose an action:"
    ),
    openESPIDfManager,
    chooseExisting
  );
  if (!action) {
    return;
  }

  if (action === openESPIDfManager) {
    vscode.commands.executeCommand("espIdf.installManager");
    return;
  } else if (action === chooseExisting) {
    await showExistingEspIDfSetups(workspace, espIdfStatusBar);
    return;
  }
}

export async function showExistingEspIDfSetups(
  workspace: vscode.Uri,
  espIdfStatusBar: vscode.StatusBarItem
) {
  const notificationMode = readParameter(
    "idf.notificationMode",
    workspace
  ) as string;
  const ProgressLocation =
    notificationMode === NotificationMode.All ||
    notificationMode === NotificationMode.Notifications
      ? vscode.ProgressLocation.Notification
      : vscode.ProgressLocation.Window;

  let idfSetups = await getIdfSetups(false);
  if (idfSetups.length === 0) {
    return;
  }
  await vscode.window.withProgress(
    {
      cancellable: false,
      location: ProgressLocation,
      title: "ESP-IDF: Loading existing ESP-IDF setups...",
    },
    async (
      progress: vscode.Progress<{ message: string; increment: number }>,
      cancelToken: vscode.CancellationToken
    ) => {
      try {
        const options = idfSetups.map((existingSetup) => {
          return {
            label: `ESP-IDF ${existingSetup.version} in ${existingSetup.idfPath}`,
            target: existingSetup,
          };
        });
        const selectedSetup = await vscode.window.showQuickPick(options, {
          placeHolder: "Select a ESP-IDF setup to use",
        });
        if (!selectedSetup) {
          return;
        }
        await useIdfSetupSettings(
          selectedSetup.target,
          vscode.ConfigurationTarget.WorkspaceFolder,
          workspace,
          espIdfStatusBar
        );
      } catch (error) {
        const msg = error.message
          ? error.message
          : "Error loading initial configuration.";
        Logger.errorNotify(msg, error, "checkExtensionSettings");
      }
    }
  );
}
