export class UpdateProductDto {
  name: string;
  price: number;
  stock: number;
  // Client must provide current version for optimistic locking
  version: number;
}
