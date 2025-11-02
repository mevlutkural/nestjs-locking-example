import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  findAll(): Promise<Product[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<Product> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Product not found');
    return entity;
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    if (dto.version !== existing.version) {
      throw new ConflictException('Optimistic lock conflict: stale version');
    }

    const entity = this.repo.merge(existing, {
      name: dto.name,
      price: dto.price,
      stock: dto.stock,
    });

    return this.repo.save(entity);
  }
}
