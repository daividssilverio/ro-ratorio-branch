import { ProjectCredit, reuseNotice } from "./rights.tsx";
import { DisplayToggles } from "./text/DisplayToggles.tsx";

export function RightsFooter() {
    return (
        <footer className="rights">
            <DisplayToggles />
            © Gravity Co., Ltd. &amp; Lee MyoungJin(studio DTDS). All rights reserved.
            <br />© GungHo Online Entertainment, Inc. All Rights Reserved.
            <br />
            {reuseNotice}
            <br />
            <br />
            <ProjectCredit />
        </footer>
    );
}
