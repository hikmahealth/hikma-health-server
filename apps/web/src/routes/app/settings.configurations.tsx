import { Button } from "@hh/ui/components/button";
import { Checkbox } from "@hh/ui/components/checkbox";
import { Input } from "@hh/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hh/ui/components/dialog";
import { getCurrentUser } from "@/lib/server-functions/auth";
import { permissionsMiddleware } from "@/middleware/auth";
import AppConfig from "@/models/app-config";
import User from "@/models/user";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useImmerReducer } from "use-immer";

const saveConfiguration = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      // TODO: set this to the type of a namespace from the AppConfig module
      namespace: string;
      key: string;
      displayName: string | null;
      value: string | null | boolean | number;
      dataType: AppConfig.DataTypeT;
      updatedBy: string;
    }) => data,
  )
  .middleware([permissionsMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.userId || context.role !== User.ROLES.SUPER_ADMIN) {
      return Promise.reject({
        message: "Unauthorized: Isufficient permissions",
        source: "saveConfiguration",
      });
    }
    const { namespace, key, displayName, value, dataType, updatedBy } = data;
    return await AppConfig.API.set(
      namespace,
      key,
      displayName,
      value,
      dataType,
      updatedBy,
    );
  });

const getAllConfigurations = createServerFn({ method: "GET" })
  .middleware([permissionsMiddleware])
  .handler(async ({ context }) => {
    if (!context.userId || context.role !== User.ROLES.SUPER_ADMIN) {
      return Promise.reject({
        message: "Unauthorized: Isufficient permissions",
        source: "getAllConfigurations",
      });
    }
    return await AppConfig.API.getAll();
  });

export const Route = createFileRoute("/app/settings/configurations")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const config = await getAllConfigurations();
    return { config, currentUser: await getCurrentUser() };
  },
});

const overrideMobilePermissionsConfirmation =
  "I am sure I want to disable permissions on mobile devices";

function RouteComponent() {
  const { config, currentUser } = Route.useLoaderData();
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<{
    title: string;
    description: string;
    onConfirm: <T1 extends string>(arg1: T1) => void;
    confirmationText?: string;
    userInputText?: string;
  } | null>(null);

  const [organizationName, setOrganizationName] = useState(
    AppConfig.Utils.getValue<string>(
      config,
      AppConfig.Namespaces.ORGANIZATION,
      "organization-name",
    ) || "",
  );

  const isMobilePermissionsOverridden =
    AppConfig.Utils.getValue<boolean>(
      config,
      AppConfig.Namespaces.AUTH,
      "disable-mobile-permissions-checking",
    ) || false;

  const handleSaveOrganizationName = () => {
    console.log("handleSaveOrganizationName");
    // TODO: send to sign in page if there is no user
    if (!currentUser) return;

    saveConfiguration({
      data: {
        namespace: AppConfig.Namespaces.ORGANIZATION,
        key: "organization-name",
        displayName: "Organization Name",
        value: organizationName,
        dataType: "string",
        updatedBy: currentUser.id,
      },
    })
      .then(() => {
        toast.success("Organization name saved successfully");
      })
      .catch((error) => {
        toast.error(`Failed to save organization name: ${error.message}`);
      })
      .finally(() => {
        router.invalidate({ sync: true });
      });
  };

  const handleToggleOverrideMobilePermissions = (checked: boolean) => {
    console.log("handleToggleOverrideMobilePermissions", checked);

    // If it is currently enabled, just disable without confirmation
    if (!currentUser) return;
    if (checked === false) {
      return saveConfiguration({
        data: {
          namespace: AppConfig.Namespaces.AUTH,
          key: "disable-mobile-permissions-checking",
          displayName: "Override Mobile Permissions",
          value: checked,
          dataType: "boolean",
          updatedBy: currentUser.id,
        },
      })
        .then(() => {
          toast.success("Override mobile permissions disabled successfully");
        })
        .catch((error) => {
          toast.error(
            `Failed to disable override mobile permissions: ${error.message}`,
          );
        })
        .finally(() => {
          router.invalidate({ sync: true });
        });
    }

    // Confirm before toggling, ask user if they are sure and ask them to type "confirm"
    setOpenDialog({
      title: "Toggle Override Mobile Permissions",
      description: `
      Are you sure you want to toggle override mobile permissions?

      Type "${overrideMobilePermissionsConfirmation}" to confirm`,
      confirmationText: overrideMobilePermissionsConfirmation,
      userInputText: "",
      onConfirm: (userInputText: string) => {
        console.log({ userInputText });
        if (userInputText === overrideMobilePermissionsConfirmation) {
          saveConfiguration({
            data: {
              namespace: AppConfig.Namespaces.AUTH,
              key: "disable-mobile-permissions-checking",
              displayName: "Override Mobile Permissions",
              value: checked,
              dataType: "boolean",
              updatedBy: currentUser.id,
            },
          })
            .then(() => {
              toast.success("Override mobile permissions toggled successfully");
              setOpenDialog(null);
            })
            .catch((error) => {
              toast.error(
                `Failed to toggle override mobile permissions: ${error.message}`,
              );
            })
            .finally(() => {
              router.invalidate({ sync: true });
            });
        } else {
          toast.error("Invalid confirmation text", { richColors: true });
        }
      },
    });
  };

  console.log({ organizationName });

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configurations</h1>
          <div className="text-sm text-muted-foreground">
            Settings and configuration flags that can be set for the entire
            Hikma Health Application.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        <div className="flex flex-row gap-4 items-end">
          <Input
            label="Organization Name"
            description="The name of your organization"
            defaultValue={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="lg:w-md"
          />
          <Button onClick={handleSaveOrganizationName}>Save</Button>
        </div>

        <div className="flex flex-row gap-14 items-end">
          <Checkbox
            label="Override Mobile Permissions"
            description="Override the mobile permissions for all users"
            color="destructive"
            checked={isMobilePermissionsOverridden}
            onCheckedChange={handleToggleOverrideMobilePermissions}
          />
        </div>
      </div>
      <Dialog
        open={openDialog !== null}
        onOpenChange={() => setOpenDialog(null)}
      >
        {openDialog !== null && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{openDialog.title}</DialogTitle>
            </DialogHeader>

            <DialogDescription>
              {openDialog.description}
              <br />
              <br />
              <Input
                value={openDialog.userInputText}
                onChange={({ target }) =>
                  setOpenDialog({ ...openDialog, userInputText: target.value })
                }
              />
            </DialogDescription>

            <DialogFooter>
              <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
              <Button
                onClick={() =>
                  openDialog.onConfirm(openDialog.userInputText || "")
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
