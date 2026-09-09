import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { UserService } from "./user.service.js";
// import { CreateUserDto } from "./dto/create-user.dto.js";

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) { }
	
	// @Post()
	// create(@Body() createUserDto: CreateUserDto) {
	// 	return this.userService.create(createUserDto)
	// }

	@Get()
	findAll() {
		return this.userService.findAll()
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.userService.findOne(id)
	}
}

