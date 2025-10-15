// Example demonstrating the <max> block functionality

import { render } from '@anysphere/priompt';

function ExampleMaxBlock() {
  return (
    <>
      <scope p={100}>This is high priority content outside the max block.</scope>
      
      <max tokenLimit={50}>
        <scope p={200}>This is the highest priority content inside max block.</scope>
        <scope p={150}>This is medium priority content inside max block.</scope>
        <scope p={50}>This is lower priority content inside max block.</scope>
      </max>
      
      <scope p={125}>This is medium-high priority content outside the max block.</scope>
    </>
  );
}

// How this works:
// 1. The <max> block limits its content to 50 tokens
// 2. BUT the priorities inside the max block (200, 150, 50) participate in the global priority calculation
// 3. So if we have limited global tokens, the content with priority 200 will be included first (highest globally)
// 4. Then priority 150, then priority 125 (outside max), then priority 100 (outside max), then priority 50 (inside max)
// 5. However, if the max block's 50 token limit is reached, lower priority content within it will be excluded

// This is different from <isolate> which would:
// 1. Render its contents separately with its own token limit
// 2. NOT participate in global priority calculation
// 3. Be included/excluded as a whole unit based on the isolate block's own priority

export default ExampleMaxBlock;