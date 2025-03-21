<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# IrysXyz GOAT Plugin

Deploy [Irys](https://irys.xyz/) plugins.

## Installation
```bash
npm install @goat-sdk/plugin-irys-xyz
yarn add @goat-sdk/plugin-irys-xyz
pnpm add @goat-sdk/plugin-irys-xyz
```

## Usage
```typescript
import { irysxyz } from '@goat-sdk/plugin-irys-xyz';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       irysxyz()
    ]
});
```

## Tools
* Deploy an Irys plugin.

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/4821833e-52e5-4126-a2a1-59e9fa9bebd7" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
