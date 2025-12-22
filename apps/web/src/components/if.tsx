import React from "react";

type Props = {
  show: boolean;
  children: React.ReactNode;
};

function If(props: Props) {
  return <>{props.show && props.children}</>;
}

export default If;
