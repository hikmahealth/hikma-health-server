import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/app/entries")({
  component: RootComponent,
});

function RootComponent() {
  return (
    <main>
      <Header />
      <Table />
    </main>
  );
}

function Header() {
  const uploadFn = useMutation({
    mutationFn: async (files: File | null) => {
      if (!files) {
        throw new Error("missing file");
      }

      const formData = new FormData();
      formData.append("file", files);
      await fetch("/api/entries/backfill", {
        method: "POST",
        body: formData,
      });
    },
  });

  const [files, setFiles] = React.useState<File | null>(null);
  const ref = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        type="file"
        accept=".csv"
        ref={ref}
        onChange={function (e) {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          setFiles(file);
        }}
      />
      <Button
        disabled={uploadFn.isPending}
        onClick={() => uploadFn.mutate(files)}
      >
        {uploadFn.isPending ? "Uploading..." : "Import CSV"}
      </Button>
    </>
  );
}

/**
 * To render the table that would contain the patient list
 * @returns
 */
function Table() {
  return <div></div>;
}
