import type { NextPage } from "next";
import { FileDrop } from "../src/src-client/components/dom/fileDrop";
import { ViewerContainer } from "../src/src-client/components/dom/viewer";
import { useBuffer } from "../src/src-client/hooks/useBuffer";

import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  const { buffer, onDrop, fileUpload, testFileUpload } = useBuffer();

  return (
    <div style={{ height: "100%" }}>
      {buffer ? (
        <ViewerContainer buffer={buffer} fileUpload={fileUpload} />
      ) : (
        <FileDrop onDrop={onDrop} testFileUpload={testFileUpload} />
      )}
    </div>
  );
};

export default Home;
