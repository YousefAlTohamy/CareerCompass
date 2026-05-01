<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TargetJobRole extends Model
{
    protected $fillable = ['name', 'search_query', 'is_active'];
}
